"""
POST /api/utilization

Actions:
  provider_utilization – SUM(booked_hours) / SUM(scheduled_hours) per employee
  revenue_per_hour     – SUM(sales_exc_tax) / SUM(booked_hours) via JOIN
  role_summary         – revenue + utilization grouped by job_name
  daily_utilization    – day-by-day utilization % per center

Performance: all run_query calls replaced with run_query_async.
The 3 actions the frontend fires on load now run concurrently on the
server side (each is a single async query — no internal sub-queries).
"""

import asyncio
from fastapi import APIRouter, Request
from utils.errors import error_response
from core.config import (
    get_sales_table, get_schedule_table, run_query_async, to_float,
    build_center_clause, month_context, current_month,
)

router = APIRouter(tags=["Utilization"])

REV = "sales_exc_tax"


@router.post("/api/utilization")
async def utilization(request: Request):
    body = await request.json()
    if isinstance(body, list):
        body = body[0] if body else {}

    action = str(body.get("action", "provider_utilization")).lower()
    month  = body.get("month") or current_month()
    center = body.get("center", None)

    sales_tbl = get_sales_table()
    sched_tbl = get_schedule_table()

    ctx          = month_context(month)
    CENTER_SCHED = build_center_clause(center, field="s.center_name")
    CENTER_SALES = build_center_clause(center, field="sa.center_name")

    try:
        # ── PROVIDER UTILIZATION ──────────────────────────────────────────────
        if action == "provider_utilization":
            q = f"""
                SELECT
                    s.employee_name                             AS employee,
                    s.job_name                                  AS role,
                    s.center_name                               AS center,
                    SUM(s.scheduled_hours)                      AS scheduled_hours,
                    SUM(s.booked_hours)                         AS booked_hours,
                    SAFE_DIVIDE(SUM(s.booked_hours), SUM(s.scheduled_hours)) AS utilization_rate
                FROM {sched_tbl} s
                WHERE s.date BETWEEN '{ctx["start_str"]}' AND '{ctx["today"]}'
                  AND s.scheduled_hours > 0{CENTER_SCHED}
                GROUP BY employee, role, center
                HAVING scheduled_hours > 0
                ORDER BY utilization_rate DESC
                LIMIT 30
            """
            rows = await run_query_async(q)
            return {
                "data": [
                    {
                        "employee":        r.employee,
                        "role":            r.role,
                        "center":          r.center,
                        "scheduled_hours": to_float(r.scheduled_hours),
                        "booked_hours":    to_float(r.booked_hours),
                        "utilization_pct": round(to_float(r.utilization_rate) * 100, 1),
                    }
                    for r in rows
                ]
            }

        # ── REVENUE PER UTILIZED HOUR ────────────────────────────────────────
        elif action == "revenue_per_hour":
            q = f"""
                SELECT
                    s.employee_name                              AS employee,
                    s.job_name                                   AS role,
                    s.center_name                                AS center,
                    SUM(s.booked_hours)                          AS booked_hours,
                    SUM(s.scheduled_hours)                       AS scheduled_hours,
                    COALESCE(SUM(sa.{REV}), 0)                  AS revenue,
                    SAFE_DIVIDE(
                        COALESCE(SUM(sa.{REV}), 0),
                        SUM(s.booked_hours)
                    )                                            AS rev_per_hour,
                    SAFE_DIVIDE(SUM(s.booked_hours), SUM(s.scheduled_hours))
                                                                 AS utilization_rate
                FROM {sched_tbl} s
                LEFT JOIN {sales_tbl} sa
                    ON LOWER(TRIM(sa.serviced_by))    = LOWER(TRIM(s.employee_name))
                   AND DATE(sa.invoice_closed_date)   = s.date
                   AND LOWER(TRIM(sa.center_name))    = LOWER(TRIM(s.center_name))
                   AND sa.status                      = 'Closed'
                WHERE s.date BETWEEN '{ctx["start_str"]}' AND '{ctx["today"]}'
                  AND s.scheduled_hours > 0{CENTER_SCHED}
                GROUP BY employee, role, center
                HAVING booked_hours > 0
                ORDER BY rev_per_hour DESC
                LIMIT 30
            """
            rows = await run_query_async(q)
            return {
                "data": [
                    {
                        "employee":        r.employee,
                        "role":            r.role,
                        "center":          r.center,
                        "booked_hours":    to_float(r.booked_hours),
                        "scheduled_hours": to_float(r.scheduled_hours),
                        "revenue":         to_float(r.revenue),
                        "rev_per_hour":    round(to_float(r.rev_per_hour), 2),
                        "utilization_pct": round(to_float(r.utilization_rate) * 100, 1),
                    }
                    for r in rows
                ]
            }

        # ── ROLE SUMMARY ──────────────────────────────────────────────────────
        elif action == "role_summary":
            q = f"""
                SELECT
                    COALESCE(NULLIF(TRIM(s.job_name), ''), 'Unassigned') AS role,
                    COUNT(DISTINCT s.employee_name)                       AS headcount,
                    SUM(s.scheduled_hours)                                AS scheduled_hours,
                    SUM(s.booked_hours)                                   AS booked_hours,
                    COALESCE(SUM(sa.{REV}), 0)                           AS revenue,
                    SAFE_DIVIDE(SUM(s.booked_hours), SUM(s.scheduled_hours))
                                                                          AS utilization_rate,
                    SAFE_DIVIDE(
                        COALESCE(SUM(sa.{REV}), 0),
                        NULLIF(SUM(s.booked_hours), 0)
                    )                                                     AS rev_per_hour
                FROM {sched_tbl} s
                LEFT JOIN {sales_tbl} sa
                    ON LOWER(TRIM(sa.serviced_by))  = LOWER(TRIM(s.employee_name))
                   AND DATE(sa.invoice_closed_date) = s.date
                   AND LOWER(TRIM(sa.center_name))  = LOWER(TRIM(s.center_name))
                   AND sa.status                    = 'Closed'
                WHERE s.date BETWEEN '{ctx["start_str"]}' AND '{ctx["today"]}'
                  AND s.scheduled_hours > 0{CENTER_SCHED}
                GROUP BY role
                ORDER BY revenue DESC
            """
            rows = await run_query_async(q)
            return {
                "data": [
                    {
                        "role":            r.role,
                        "headcount":       int(r.headcount or 0),
                        "scheduled_hours": to_float(r.scheduled_hours),
                        "booked_hours":    to_float(r.booked_hours),
                        "revenue":         to_float(r.revenue),
                        "utilization_pct": round(to_float(r.utilization_rate) * 100, 1),
                        "rev_per_hour":    round(to_float(r.rev_per_hour), 2),
                    }
                    for r in rows
                ]
            }

        # ── DAILY UTILIZATION ─────────────────────────────────────────────────
        elif action == "daily_utilization":
            q = f"""
                SELECT
                    s.date,
                    s.center_name                                        AS center,
                    SUM(s.scheduled_hours)                               AS scheduled_hours,
                    SUM(s.booked_hours)                                  AS booked_hours,
                    SAFE_DIVIDE(SUM(s.booked_hours), SUM(s.scheduled_hours))
                                                                         AS utilization_rate
                FROM {sched_tbl} s
                WHERE s.date BETWEEN '{ctx["start_str"]}' AND '{ctx["today"]}'
                  AND s.scheduled_hours > 0{CENTER_SCHED}
                GROUP BY s.date, center
                ORDER BY s.date, center
            """
            rows = await run_query_async(q)
            return {
                "data": [
                    {
                        "date":            str(r.date),
                        "center":          r.center,
                        "scheduled_hours": to_float(r.scheduled_hours),
                        "booked_hours":    to_float(r.booked_hours),
                        "utilization_pct": round(to_float(r.utilization_rate) * 100, 1),
                    }
                    for r in rows
                ]
            }

        else:
            return {"error": f"Unknown action: {action}"}

    except Exception as e:
        return error_response(e)
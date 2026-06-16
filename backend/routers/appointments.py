"""
POST /api/appointments

Actions:
  summary          – KPIs (merged with rebook_rate data — single query)
  daily            – appointments per day
  by_status        – breakdown by status
  by_category      – service_category breakdown (Closed only)
  by_provider      – per-provider counts
  by_booking_source – booking channel breakdown
  by_hour          – peak hour heatmap (Closed only)
  rebook_rate      – rebooked / closed  (shares query with summary)
  weekly           – week-over-week counts

Performance notes:
  - All actions use run_query_async (non-blocking thread pool).
  - summary previously needed a second rebook_rate call from the frontend;
    it now returns all rebook/first-visit/addon fields in one query so the
    frontend can drop the separate rebook_rate fetch if desired.
  - weekly aggregates in Python from a single day-level query (no 4 sub-queries).
"""

import asyncio
from datetime import timedelta
from fastapi import APIRouter, Request
from utils.errors import error_response
from core.config import (
    get_appt_table, run_query_async, to_float,
    build_center_clause, month_context, current_month,
)

router = APIRouter(tags=["Appointments"])


@router.post("/api/appointments")
async def appointments(request: Request):
    body = await request.json()
    if isinstance(body, list):
        body = body[0] if body else {}

    action = str(body.get("action", "summary")).lower()
    month  = body.get("month") or current_month()
    center = body.get("center", None)
    table  = get_appt_table()

    ctx    = month_context(month)
    CENTER = build_center_clause(center)

    BASE = (
        f"appointment_date BETWEEN '{ctx['start_str']}' AND '{ctx['today']}' "
        f"AND status != 'Deleted'{CENTER}"
    )

    try:
        # ── SUMMARY ──────────────────────────────────────────────────────────
        # Single query covers everything — rebook_rate action returns same data
        if action in ("summary", "rebook_rate"):
            q = f"""
                SELECT
                    COUNT(*)                                               AS total_appointments,
                    COUNTIF(status = 'Closed')                            AS closed,
                    COUNTIF(status = 'Closed (No Show)')                  AS noshows,
                    COUNTIF(status = 'Cancelled')                         AS cancelled,
                    COUNTIF(rebooked = TRUE)                              AS rebooked,
                    COUNTIF(first_visit = TRUE)                           AS first_visits,
                    COUNTIF(surprise_visit = TRUE)                        AS surprise_visits,
                    COUNTIF(UPPER(TRIM(COALESCE(add_on, ''))) = 'YES')   AS addons,
                    AVG(CASE WHEN actual_duration IS NOT NULL
                             THEN actual_duration END)                    AS avg_actual_min,
                    SUM(CASE WHEN status = 'Closed'
                              AND scheduled_service_and_recovery_duration IS NOT NULL
                             THEN scheduled_service_and_recovery_duration END)
                                                                          AS total_scheduled_min
                FROM {table}
                WHERE {BASE}
            """
            r = (await run_query_async(q))[0]

            total_appts = int(r.total_appointments or 0)
            closed      = int(r.closed or 0)
            noshows     = int(r.noshows or 0)
            cancelled   = int(r.cancelled or 0)
            rebooked    = int(r.rebooked or 0)
            first_visits = int(r.first_visits or 0)
            cap_min     = ctx["days_elapsed"] * 10 * 60
            sched_min   = to_float(r.total_scheduled_min)

            rebook_rate      = round(rebooked / closed * 100, 1) if closed > 0 else 0
            first_visit_rate = round(first_visits / closed * 100, 1) if closed > 0 else 0

            if action == "rebook_rate":
                return {
                    "total":            total_appts,
                    "closed":           closed,
                    "rebooked":         rebooked,
                    "first_visits":     first_visits,
                    "surprise_total":   int(r.surprise_visits or 0),
                    "addons":           int(r.addons or 0),
                    "rebook_rate":      rebook_rate,
                    "first_visit_rate": first_visit_rate,
                }

            return {
                "total_appointments":      total_appts,
                "closed":                  closed,
                "noshows":                 noshows,
                "cancelled":               cancelled,
                "rebooked":                rebooked,
                "first_visits":            first_visits,
                "surprise_visits":         int(r.surprise_visits or 0),
                "addons":                  int(r.addons or 0),
                "avg_per_day":             round(total_appts / ctx["days_elapsed"], 1) if ctx["days_elapsed"] else 0,
                "noshow_rate":             round(noshows / total_appts * 100, 1) if total_appts else 0,
                "cancel_rate":             round(cancelled / total_appts * 100, 1) if total_appts else 0,
                "rebook_rate":             rebook_rate,
                "first_visit_rate":        first_visit_rate,
                "utilisation_pct":         round(sched_min / cap_min * 100, 1) if cap_min else 0,
                "avg_actual_duration_min": round(to_float(r.avg_actual_min)) if r.avg_actual_min else None,
                "total_services":          total_appts,
            }

        # ── DAILY ────────────────────────────────────────────────────────────
        elif action == "daily":
            q = f"""
                SELECT appointment_date, COUNT(*) AS count
                FROM {table}
                WHERE {BASE}
                GROUP BY appointment_date ORDER BY appointment_date
            """
            rows = await run_query_async(q)
            cumulative, data = 0, []
            for r in rows:
                cumulative += int(r.count or 0)
                data.append({
                    "date":       str(r.appointment_date),
                    "count":      int(r.count or 0),
                    "cumulative": cumulative,
                })
            return {"data": data}

        # ── BY STATUS ────────────────────────────────────────────────────────
        elif action == "by_status":
            q = f"""
                SELECT COALESCE(status, 'Unknown') AS status, COUNT(*) AS count
                FROM {table}
                WHERE {BASE}
                GROUP BY status ORDER BY count DESC
            """
            rows  = await run_query_async(q)
            total = sum(int(r.count or 0) for r in rows)
            return {
                "data": [
                    {
                        "status": r.status,
                        "count":  int(r.count or 0),
                        "pct":    round(int(r.count or 0) / total * 100, 1) if total else 0,
                    }
                    for r in rows
                ]
            }

        # ── BY CATEGORY ──────────────────────────────────────────────────────
        elif action == "by_category":
            q = f"""
                SELECT
                    COALESCE(NULLIF(TRIM(service_category), ''), 'Uncategorised') AS category,
                    COUNT(*) AS count
                FROM {table}
                WHERE {BASE} AND status = 'Closed'
                GROUP BY category ORDER BY count DESC LIMIT 10
            """
            rows  = await run_query_async(q)
            total = sum(int(r.count or 0) for r in rows)
            return {
                "data": [
                    {
                        "category": r.category,
                        "count":    int(r.count or 0),
                        "pct":      round(int(r.count or 0) / total * 100, 1) if total else 0,
                    }
                    for r in rows
                ]
            }

        # ── BY PROVIDER ──────────────────────────────────────────────────────
        elif action == "by_provider":
            q = f"""
                SELECT
                    COALESCE(NULLIF(TRIM(providers), ''), 'Unassigned') AS provider,
                    COUNT(*)                           AS count,
                    COUNTIF(status = 'Closed')         AS closed_count,
                    COUNTIF(rebooked = TRUE)           AS rebooked_count
                FROM {table}
                WHERE {BASE}
                GROUP BY provider ORDER BY count DESC LIMIT 15
            """
            rows  = await run_query_async(q)
            total = sum(int(r.count or 0) for r in rows)
            return {
                "data": [
                    {
                        "provider":       r.provider,
                        "count":          int(r.count or 0),
                        "closed_count":   int(r.closed_count or 0),
                        "rebooked_count": int(r.rebooked_count or 0),
                        "rebook_rate":    round(
                            int(r.rebooked_count or 0) / int(r.closed_count or 1) * 100, 1
                        ) if r.closed_count else 0,
                        "pct":            round(int(r.count or 0) / total * 100, 1) if total else 0,
                    }
                    for r in rows
                ]
            }

        # ── BY BOOKING SOURCE ────────────────────────────────────────────────
        elif action == "by_booking_source":
            q = f"""
                SELECT
                    COALESCE(NULLIF(TRIM(booking_source), ''), 'Unknown') AS source,
                    COUNT(*) AS count
                FROM {table}
                WHERE {BASE}
                GROUP BY source ORDER BY count DESC LIMIT 12
            """
            rows  = await run_query_async(q)
            total = sum(int(r.count or 0) for r in rows)
            return {
                "data": [
                    {
                        "source": r.source,
                        "count":  int(r.count or 0),
                        "pct":    round(int(r.count or 0) / total * 100, 1) if total else 0,
                    }
                    for r in rows
                ]
            }

        # ── BY HOUR ──────────────────────────────────────────────────────────
        elif action == "by_hour":
            q = f"""
                SELECT
                    EXTRACT(HOUR FROM start_time) AS hour,
                    COUNT(*)                      AS count
                FROM {table}
                WHERE {BASE}
                  AND status = 'Closed'
                  AND start_time IS NOT NULL
                GROUP BY hour ORDER BY hour
            """
            rows = await run_query_async(q)
            return {"data": [{"hour": int(r.hour), "count": int(r.count or 0)} for r in rows]}

        # ── WEEKLY ───────────────────────────────────────────────────────────
        elif action == "weekly":
            q = f"""
                SELECT
                    appointment_date,
                    COUNT(*)                               AS total,
                    COUNTIF(status = 'Closed')             AS closed,
                    COUNTIF(status = 'Closed (No Show)')   AS noshows,
                    COUNTIF(status = 'Cancelled')          AS cancelled
                FROM {table}
                WHERE {BASE}
                GROUP BY appointment_date ORDER BY appointment_date
            """
            rows  = await run_query_async(q)
            daily = {
                str(r.appointment_date): {
                    "total":     int(r.total or 0),
                    "closed":    int(r.closed or 0),
                    "noshows":   int(r.noshows or 0),
                    "cancelled": int(r.cancelled or 0),
                }
                for r in rows
            }
            weeks = []
            for week_num in range(4):
                week_start = ctx["start_date"] + timedelta(days=week_num * 7)
                totals = {"total": 0, "closed": 0, "noshows": 0, "cancelled": 0}
                for d in range(7):
                    day_str = str(week_start + timedelta(days=d))
                    for k in totals:
                        totals[k] += daily.get(day_str, {}).get(k, 0)
                weeks.append({"week": f"Week {week_num + 1}", **totals})
            for i, week in enumerate(weeks):
                prev        = weeks[i - 1]["total"] if i > 0 else 0
                week["wow"] = (
                    None if i == 0 or prev == 0
                    else round((week["total"] - prev) / prev * 100, 2)
                )
            return {"weeks": weeks}

        else:
            return {"error": f"Unknown action: {action}"}

    except Exception as e:
        return error_response(e)
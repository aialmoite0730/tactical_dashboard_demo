"""
POST /api/leaderboard

Actions:
  staff         – revenue leaderboard per staff member
  staff_trend   – daily revenue trend for top-N staff
  service_types – revenue by servicer (serviced_by)
  referrals     – count + revenue by referral_source

Performance: all run_query calls replaced with run_query_async.
"""

import asyncio
from fastapi import APIRouter, Request
from utils.errors import error_response
from core.config import (
    get_sales_table, run_query_async, to_float,
    build_center_clause, month_context, current_month,
)

router = APIRouter(tags=["Leaderboard"])

REV = "sales_exc_tax"


@router.post("/api/leaderboard")
async def leaderboard(request: Request):
    body = await request.json()
    if isinstance(body, list):
        body = body[0] if body else {}

    action = str(body.get("action", "staff")).lower()
    month  = body.get("month") or current_month()
    center = body.get("center", None)
    table  = get_sales_table()

    ctx    = month_context(month)
    CENTER = build_center_clause(center)
    CLOSED_MTD = (
        f"DATE(invoice_closed_date) BETWEEN '{ctx['start_str']}' AND '{ctx['today']}' "
        f"AND status = 'Closed'{CENTER}"
    )

    try:
        # ── STAFF LEADERBOARD ─────────────────────────────────────────────────
        if action == "staff":
            q = f"""
                SELECT
                    COALESCE(NULLIF(TRIM(sold_by), ''), 'Unknown') AS staff,
                    SUM({REV})                                      AS revenue,
                    COUNT(DISTINCT invoice_no)                      AS invoice_count,
                    SUM(qty)                                        AS units_sold,
                    SAFE_DIVIDE(SUM({REV}), COUNT(DISTINCT invoice_no)) AS asp
                FROM {table}
                WHERE {CLOSED_MTD}
                GROUP BY staff
                HAVING revenue > 0
                ORDER BY revenue DESC
                LIMIT 20
            """
            rows  = await run_query_async(q)
            total = sum(to_float(r.revenue) for r in rows)
            data  = []
            for i, r in enumerate(rows):
                rev = to_float(r.revenue)
                data.append({
                    "rank":          i + 1,
                    "staff":         r.staff,
                    "revenue":       rev,
                    "share":         round(rev / total * 100, 1) if total > 0 else 0,
                    "invoice_count": int(r.invoice_count or 0),
                    "units_sold":    to_float(r.units_sold),
                    "asp":           to_float(r.asp),
                })
            return {"data": data, "total": total}

        # ── STAFF TREND ───────────────────────────────────────────────────────
        elif action == "staff_trend":
            top_n = int(body.get("top_n", 5))
            q_top = f"""
                SELECT COALESCE(NULLIF(TRIM(sold_by), ''), 'Unknown') AS staff,
                       SUM({REV}) AS revenue
                FROM {table}
                WHERE {CLOSED_MTD}
                GROUP BY staff
                HAVING revenue > 0
                ORDER BY revenue DESC
                LIMIT {top_n}
            """
            top_rows  = await run_query_async(q_top)
            top_staff = [r.staff for r in top_rows]
            if not top_staff:
                return {"data": []}
            staff_list = ", ".join(
                f"'{s.replace(chr(39), chr(39)+chr(39))}'" for s in top_staff
            )
            q = f"""
                SELECT COALESCE(NULLIF(TRIM(sold_by), ''), 'Unknown') AS staff,
                       DATE(invoice_closed_date) AS day,
                       SUM({REV})                AS revenue
                FROM {table}
                WHERE {CLOSED_MTD}
                  AND COALESCE(NULLIF(TRIM(sold_by), ''), 'Unknown') IN ({staff_list})
                GROUP BY staff, day
                ORDER BY staff, day
            """
            rows     = await run_query_async(q)
            by_staff = {}
            for r in rows:
                by_staff.setdefault(r.staff, []).append(
                    {"date": str(r.day), "revenue": to_float(r.revenue)}
                )
            return {
                "data": [
                    {"staff": s, "trend": by_staff[s]}
                    for s in top_staff if s in by_staff
                ]
            }

        # ── SERVICE TYPES (by servicer) ───────────────────────────────────────
        elif action == "service_types":
            q = f"""
                SELECT
                    COALESCE(NULLIF(TRIM(serviced_by), ''), 'N/A')       AS servicer,
                    SUM({REV})                                            AS revenue,
                    COUNT(DISTINCT invoice_no)                            AS invoices,
                    SAFE_DIVIDE(SUM({REV}), COUNT(DISTINCT invoice_no))  AS asp
                FROM {table}
                WHERE {CLOSED_MTD}
                GROUP BY servicer
                HAVING revenue > 0
                ORDER BY revenue DESC
                LIMIT 15
            """
            rows  = await run_query_async(q)
            total = sum(to_float(r.revenue) for r in rows)
            return {
                "data": [
                    {
                        "servicer": r.servicer,
                        "revenue":  to_float(r.revenue),
                        "invoices": int(r.invoices or 0),
                        "asp":      to_float(r.asp),
                        "share":    round(to_float(r.revenue) / total * 100, 1) if total > 0 else 0,
                    }
                    for r in rows
                ],
                "total": total,
            }

        # ── REFERRALS ─────────────────────────────────────────────────────────
        elif action == "referrals":
            q = f"""
                SELECT
                    COALESCE(NULLIF(TRIM(referral_source), ''), 'Not specified') AS source,
                    COUNT(DISTINCT invoice_no)  AS count,
                    SUM({REV})                  AS revenue
                FROM {table}
                WHERE {CLOSED_MTD}
                GROUP BY source
                ORDER BY count DESC
                LIMIT 10
            """
            rows  = await run_query_async(q)
            total = sum(int(r.count or 0) for r in rows)
            return {
                "data": [
                    {
                        "source":  r.source,
                        "count":   int(r.count or 0),
                        "revenue": to_float(r.revenue),
                        "share":   round(int(r.count or 0) / total * 100, 1) if total > 0 else 0,
                    }
                    for r in rows
                ],
                "total": total,
            }

        else:
            return {"error": f"Unknown action: {action}"}

    except Exception as e:
        return error_response(e)
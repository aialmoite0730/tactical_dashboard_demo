"""
POST /api/revenue

Actions:
  summary    – MTD revenue KPIs (single merged query — was 5 sequential queries)
  daily      – day-by-day revenue + cumulative vs goal
  categories – sales mix by item_category / item_sub_category
  weekly     – week-over-week revenue
  asp        – Average Selling Price standalone
  cash_sales – SUM(collected) WHERE payment_type = 'Cash'

Performance notes:
  - All actions use run_query_async so BigQuery runs in a thread pool,
    never blocking the event loop.
  - summary previously fired 5 sequential queries; now it's 1 merged query
    + 1 ADV query running concurrently via asyncio.gather().
"""

import os
import asyncio
from datetime import timedelta
from fastapi import APIRouter, Request
from utils.errors import error_response
from core.config import (
    get_sales_table, run_query_async, to_float,
    build_center_clause, month_context, current_month,
)

router = APIRouter(tags=["Revenue"])

REV = "sales_exc_tax"


@router.post("/api/revenue")
async def revenue(request: Request):
    body = await request.json()
    if isinstance(body, list):
        body = body[0] if body else {}

    action = str(body.get("action", "summary")).lower()
    month  = body.get("month") or current_month()
    center = body.get("center", None)
    table  = get_sales_table()

    ctx    = month_context(month)
    CENTER = build_center_clause(center)

    CLOSED_MTD = (
        f"DATE(invoice_closed_date) BETWEEN '{ctx['start_str']}' AND '{ctx['today']}' "
        f"AND status = 'Closed'{CENTER}"
    )
    CLOSED_FULL = (
        f"DATE(invoice_closed_date) BETWEEN '{ctx['start_str']}' AND '{ctx['end_str']}' "
        f"AND status = 'Closed'{CENTER}"
    )

    try:
        # ── SUMMARY ──────────────────────────────────────────────────────────
        # Was: 5 separate sequential run_query() calls (~10–15s total)
        # Now: 2 queries running concurrently via asyncio.gather() (~2–3s)
        if action == "summary":
            yesterday = str(ctx["today_date"] - timedelta(days=1))

            # Single query replaces 3 of the original 5 (mtd, yesterday, asp+cash)
            q_main = f"""
                SELECT
                    COALESCE(SUM({REV}), 0)                                AS mtd_revenue,
                    COALESCE(SUM(CASE WHEN DATE(invoice_closed_date) = '{yesterday}'
                                      THEN {REV} END), 0)                 AS yesterday_revenue,
                    COALESCE(SUM(CASE WHEN UPPER(TRIM(payment_type)) = 'CASH'
                                      THEN collected END), 0)             AS cash_sales,
                    COUNT(DISTINCT invoice_no)                             AS invoice_count,
                    SAFE_DIVIDE(SUM({REV}), COUNT(DISTINCT invoice_no))   AS asp
                FROM {table}
                WHERE {CLOSED_MTD}
            """

            # 30-day ADV runs concurrently with main query
            q_adv = f"""
                SELECT COALESCE(AVG(daily), 0) AS adv FROM (
                    SELECT DATE(invoice_closed_date) AS d, SUM({REV}) AS daily
                    FROM {table}
                    WHERE DATE(invoice_closed_date)
                          BETWEEN DATE_SUB('{ctx["today"]}', INTERVAL 30 DAY)
                            AND '{ctx["today"]}'
                      AND status = 'Closed'{CENTER}
                    GROUP BY d
                )
            """

            # Fire both queries at the same time
            (main_rows, adv_rows) = await asyncio.gather(
                run_query_async(q_main),
                run_query_async(q_adv),
            )

            r   = main_rows[0]
            mtd = to_float(r.mtd_revenue)
            adv = to_float(adv_rows[0].adv)

            rev_per_day  = mtd / ctx["days_elapsed"] if ctx["days_elapsed"] > 0 else 0
            goal         = float(os.getenv("MONTHLY_GOAL", "0"))

            return {
                "mtd_revenue":       mtd,
                "projected":         rev_per_day * ctx["days_in_month"],
                "rev_per_day":       rev_per_day,
                "rev_per_hour":      rev_per_day / 10,
                "adv":               adv,
                "yesterday_revenue": to_float(r.yesterday_revenue),
                "asp":               to_float(r.asp),
                "invoice_count":     int(r.invoice_count or 0),
                "cash_sales":        to_float(r.cash_sales),
                "days_elapsed":      ctx["days_elapsed"],
                "days_in_month":     ctx["days_in_month"],
                "goal":              goal,
            }

        # ── DAILY ────────────────────────────────────────────────────────────
        elif action == "daily":
            q = f"""
                SELECT DATE(invoice_closed_date) AS day, SUM({REV}) AS daily_revenue
                FROM {table}
                WHERE {CLOSED_FULL}
                GROUP BY day ORDER BY day
            """
            rows         = await run_query_async(q)
            goal         = float(os.getenv("MONTHLY_GOAL", "0"))
            goal_per_day = goal / ctx["days_in_month"] if goal > 0 else 0
            data, cumulative = [], 0
            for i, row in enumerate(rows):
                cumulative += to_float(row.daily_revenue)
                data.append({
                    "date":           str(row.day),
                    "daily_revenue":  to_float(row.daily_revenue),
                    "mtd_cumulative": cumulative,
                    "goal_mtd":       goal_per_day * (i + 1),
                })
            return {"data": data, "goal": goal}

        # ── CATEGORIES / SALES MIX ───────────────────────────────────────────
        elif action == "categories":
            q = f"""
                SELECT
                    COALESCE(NULLIF(TRIM(item_category), ''), 'Other')    AS category,
                    COALESCE(NULLIF(TRIM(item_sub_category), ''), '')     AS sub_category,
                    SUM({REV})                                             AS revenue,
                    COUNT(DISTINCT invoice_no)                             AS invoice_count
                FROM {table}
                WHERE {CLOSED_MTD}
                GROUP BY category, sub_category
                HAVING revenue > 0
                ORDER BY revenue DESC
            """
            rows  = await run_query_async(q)
            total = sum(to_float(r.revenue) for r in rows)

            cat_totals: dict[str, float] = {}
            cat_invoices: dict[str, int] = {}
            sub_rows = []
            for r in rows:
                cat = r.category
                rev = to_float(r.revenue)
                cat_totals[cat]   = cat_totals.get(cat, 0) + rev
                cat_invoices[cat] = cat_invoices.get(cat, 0) + int(r.invoice_count or 0)
                sub_rows.append({
                    "category":      cat,
                    "sub_category":  r.sub_category,
                    "revenue":       rev,
                    "invoice_count": int(r.invoice_count or 0),
                })

            categories = [
                {
                    "category":      cat,
                    "revenue":       rev,
                    "percentage":    round(rev / total * 100, 1) if total > 0 else 0,
                    "invoice_count": cat_invoices[cat],
                }
                for cat, rev in sorted(cat_totals.items(), key=lambda x: -x[1])
            ]
            return {"total": total, "categories": categories, "breakdown": sub_rows}

        # ── ASP (standalone) ─────────────────────────────────────────────────
        elif action == "asp":
            q = f"""
                SELECT
                    DATE_TRUNC(DATE(invoice_closed_date), MONTH) AS month,
                    SUM({REV})                                    AS revenue,
                    COUNT(DISTINCT invoice_no)                    AS invoices,
                    SAFE_DIVIDE(SUM({REV}), COUNT(DISTINCT invoice_no)) AS asp
                FROM {table}
                WHERE {CLOSED_MTD}
                GROUP BY month ORDER BY month
            """
            rows = await run_query_async(q)
            return {
                "data": [
                    {
                        "month":    str(r.month),
                        "revenue":  to_float(r.revenue),
                        "invoices": int(r.invoices or 0),
                        "asp":      to_float(r.asp),
                    }
                    for r in rows
                ]
            }

        # ── CASH SALES (standalone) ──────────────────────────────────────────
        elif action == "cash_sales":
            q = f"""
                SELECT
                    DATE(invoice_closed_date) AS day,
                    SUM(collected)            AS cash_collected,
                    COUNT(DISTINCT invoice_no) AS cash_invoices
                FROM {table}
                WHERE {CLOSED_MTD}
                  AND UPPER(TRIM(payment_type)) = 'CASH'
                GROUP BY day ORDER BY day
            """
            rows  = await run_query_async(q)
            total = sum(to_float(r.cash_collected) for r in rows)
            return {
                "total_cash": total,
                "data": [
                    {
                        "date":           str(r.day),
                        "cash_collected": to_float(r.cash_collected),
                        "cash_invoices":  int(r.cash_invoices or 0),
                    }
                    for r in rows
                ],
            }

        # ── WEEKLY ───────────────────────────────────────────────────────────
        elif action == "weekly":
            q = f"""
                SELECT DATE(invoice_closed_date) AS day, SUM({REV}) AS daily_revenue
                FROM {table}
                WHERE {CLOSED_MTD}
                GROUP BY day ORDER BY day
            """
            rows  = await run_query_async(q)
            daily = {str(r.day): to_float(r.daily_revenue) for r in rows}
            weeks = []
            for week_num in range(4):
                week_start = ctx["start_date"] + timedelta(days=week_num * 7)
                total = sum(
                    daily.get(str(week_start + timedelta(days=d)), 0) for d in range(7)
                )
                weeks.append({"week": f"Week {week_num + 1}", "revenue": total})
            for i, week in enumerate(weeks):
                prev        = weeks[i - 1]["revenue"] if i > 0 else 0
                week["wow"] = (
                    None if i == 0 or prev == 0
                    else round((week["revenue"] - prev) / prev * 100, 2)
                )
            return {"weeks": weeks, "full_month_pace": sum(w["revenue"] for w in weeks)}

        else:
            return {"error": f"Unknown action: {action}"}

    except Exception as e:
        return error_response(e)


# Legacy alias
@router.post("/api/dashboard")
async def dashboard(request: Request):
    return await revenue(request)
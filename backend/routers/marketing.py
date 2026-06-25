"""
POST /api/marketing

Actions:
  funnel     – Ad Spend → Clicks → New Clients → New-Client Revenue + derived KPIs
  by_source  – ad spend split by source (% of total spend)

Notes:
  - Marketing table has NO center column → spend/clicks/source filter by date only.
    The center filter applies to the client + revenue stages, not to spend.
  - New / returning clients come from the appointments table (first_visit BOOLEAN).
  - New-client revenue = closed sales that match a first-visit appointment on
    serviced_by/date/center (same join keys as utilization.py). Uses EXISTS rather
    than a JOIN so a sales row is never double-counted when several first-visit
    appointments share the same provider/date/center.
  - funnel fires its 3 queries concurrently via asyncio.gather.
"""

import asyncio
from fastapi import APIRouter, Request
from utils.errors import error_response
from core.config import (
    get_marketing_table, get_appt_table, get_sales_table,
    run_query_async, to_float, build_center_clause,
    month_context, current_month,
)

router = APIRouter(tags=["Marketing"])

REV = "sales_exc_tax"


@router.post("/api/marketing")
async def marketing(request: Request):
    body = await request.json()
    if isinstance(body, list):
        body = body[0] if body else {}

    action = str(body.get("action", "funnel")).lower()
    month  = body.get("month") or current_month()
    center = body.get("center", None)

    mkt_tbl   = get_marketing_table()
    appt_tbl  = get_appt_table()
    sales_tbl = get_sales_table()

    ctx          = month_context(month)
    CENTER_APPT  = build_center_clause(center)                        # appt:  center_name
    CENTER_SALES = build_center_clause(center, field="sa.center_name")

    # Marketing table has no center column — date filter only.
    SPEND_WHERE = f"date BETWEEN '{ctx['start_str']}' AND '{ctx['today']}'"

    try:
        # ── FUNNEL ───────────────────────────────────────────────────────────
        if action == "funnel":
            q_spend = f"""
                SELECT
                    COALESCE(SUM(spend), 0)  AS ad_spend,
                    COALESCE(SUM(clicks), 0) AS clicks
                FROM {mkt_tbl}
                WHERE {SPEND_WHERE}
            """

            q_clients = f"""
                SELECT
                    COUNTIF(first_visit = TRUE)  AS new_clients,
                    COUNTIF(first_visit = FALSE) AS returning_clients
                FROM {appt_tbl}
                WHERE appointment_date BETWEEN '{ctx['start_str']}' AND '{ctx['today']}'
                  AND status != 'Deleted'{CENTER_APPT}
            """

            # New-client revenue: closed sales tied to a first-visit appointment.
            # EXISTS (not JOIN) keeps each sales row counted at most once.
            q_revenue = f"""
                SELECT COALESCE(SUM(sa.{REV}), 0) AS new_client_revenue
                FROM {sales_tbl} sa
                WHERE sa.status = 'Closed'
                  AND DATE(sa.invoice_closed_date)
                      BETWEEN '{ctx['start_str']}' AND '{ctx['today']}'{CENTER_SALES}
                  AND EXISTS (
                      SELECT 1
                      FROM {appt_tbl} ap
                      WHERE LOWER(TRIM(ap.providers))   = LOWER(TRIM(sa.serviced_by))
                        AND ap.appointment_date         = DATE(sa.invoice_closed_date)
                        AND LOWER(TRIM(ap.center_name)) = LOWER(TRIM(sa.center_name))
                        AND ap.first_visit              = TRUE
                        AND ap.status                  != 'Deleted'
                  )
            """

            spend_rows, client_rows, rev_rows = await asyncio.gather(
                run_query_async(q_spend),
                run_query_async(q_clients),
                run_query_async(q_revenue),
            )

            ad_spend          = to_float(spend_rows[0].ad_spend)
            clicks            = to_float(spend_rows[0].clicks)
            new_clients       = float(client_rows[0].new_clients or 0)
            returning_clients = float(client_rows[0].returning_clients or 0)
            new_revenue       = to_float(rev_rows[0].new_client_revenue)

            cac                = ad_spend / new_clients if new_clients else 0
            rev_per_new_client = new_revenue / new_clients if new_clients else 0
            roas               = new_revenue / ad_spend if ad_spend else 0
            click_rate         = clicks / ad_spend if ad_spend else 0
            new_client_rate    = new_clients / clicks if clicks else 0
            revenue_vs_spend   = new_revenue / ad_spend if ad_spend else 0

            return {
                "ad_spend":           ad_spend,
                "clicks":             clicks,
                "new_clients":        new_clients,
                "returning_clients":  returning_clients,
                "new_client_revenue": new_revenue,
                "cac":                cac,
                "rev_per_new_client": rev_per_new_client,
                "roas":               roas,
                "click_rate":         click_rate,
                "new_client_rate":    new_client_rate,
                "revenue_vs_spend":   revenue_vs_spend,
            }

        # ── BY SOURCE ────────────────────────────────────────────────────────
        elif action == "by_source":
            q = f"""
                SELECT
                    COALESCE(NULLIF(TRIM(source), ''), 'Unknown')   AS source,
                    COALESCE(SUM(spend), 0)                         AS ad_spend,
                    SAFE_DIVIDE(SUM(spend), SUM(SUM(spend)) OVER()) AS pct_total_spend
                FROM {mkt_tbl}
                WHERE {SPEND_WHERE}
                GROUP BY source
                ORDER BY ad_spend DESC
            """
            rows = await run_query_async(q)
            return {
                "data": [
                    {
                        "source":          r.source,
                        "ad_spend":        to_float(r.ad_spend),
                        "pct_total_spend": to_float(r.pct_total_spend),
                    }
                    for r in rows
                ]
            }

        else:
            return {"error": f"Unknown action: {action}"}

    except Exception as e:
        return error_response(e)

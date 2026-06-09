import os
import base64
import json
import tempfile
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import bigquery
from dotenv import load_dotenv
from datetime import datetime, date, timedelta

load_dotenv()

# ─── Credentials ─────────────────────────────────────────────────────────────
def setup_credentials():
    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    creds_b64  = os.getenv("BIGQUERY_CREDENTIALS_BASE64")
    if creds_b64:
        try:
            creds_json = base64.b64decode(creds_b64).decode("utf-8")
            creds_dict = json.loads(creds_json)
            tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False)
            tmp.write(json.dumps(creds_dict))
            tmp.close()
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = tmp.name
            print(f"✅ Credentials loaded from Base64: {tmp.name}")
            return
        except Exception as e:
            raise Exception(f"Failed to decode BIGQUERY_CREDENTIALS_BASE64: {e}")
    elif creds_path:
        if os.path.exists(creds_path):
            print(f"✅ Credentials loaded from file: {creds_path}")
            return
        raise FileNotFoundError(f"Credentials file not found at: {creds_path}")
    else:
        raise EnvironmentError(
            "No Google Cloud credentials found. "
            "Set GOOGLE_APPLICATION_CREDENTIALS or BIGQUERY_CREDENTIALS_BASE64."
        )

setup_credentials()

# ─── Helpers ─────────────────────────────────────────────────────────────────
def to_float(val):
    return 0.0 if val is None else float(val)

def get_table():
    project = os.getenv("BIGQUERY_PROJECT_ID", "your-project")
    dataset = os.getenv("BIGQUERY_DATASET",    "your_dataset")
    table   = os.getenv("BIGQUERY_TABLE",      "sales_accrual")
    return f"`{project}.{dataset}.{table}`"

def get_appt_table():
    project = os.getenv("BIGQUERY_PROJECT_ID")
    dataset = os.getenv("BIGQUERY_DATASET")
    table   = os.getenv("BIGQUERY_APPT_TABLE")
    return f"`{project}.{dataset}.{table}`"

def get_month_bounds(month_str: str) -> tuple[str, str]:
    target = datetime.strptime(month_str, "%Y-%m").date()
    start  = target.replace(day=1)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1, day=1) - timedelta(days=1)
    else:
        end = start.replace(month=start.month + 1, day=1) - timedelta(days=1)
    return str(start), str(end)

def current_month() -> str:
    return date.today().strftime("%Y-%m")

def build_center_clause(center: str | None, field: str = "center_name") -> str:
    if center and center.strip() and center.strip().lower() != "all":
        safe = center.replace("'", "''")
        return f" AND {field} = '{safe}'"
    return ""

# ─── Confirmed status values from sample data ─────────────────────────────────
# Closed, Deleted, Closed (No Show), Cancelled, Open
# "Active" appointments (completed services): Closed
# "No show":  Closed (No Show)
# "Cancelled": Cancelled
# "Deleted": Deleted (duplicate/incorrect - exclude from most metrics)
ACTIVE_STATUSES   = "'Closed', 'Closed (No Show)', 'Cancelled', 'Open'"
COMPLETED_STATUS  = "'Closed'"
NOSHOW_STATUS     = "'Closed (No Show)'"
CANCELLED_STATUS  = "'Cancelled'"
# Exclude Deleted from all counts (system/admin artifacts)

# ─── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(title="Tactical Dashboard API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = bigquery.Client()
REV    = "sales_exc_tax"

# ─────────────────────────────────────────────────────────────────────────────
# HEALTH
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}

# ─────────────────────────────────────────────────────────────────────────────
# CENTERS
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/centers")
def list_centers():
    table = get_table()
    q = f"""
        SELECT DISTINCT center_name
        FROM {table}
        WHERE center_name IS NOT NULL AND TRIM(center_name) != ''
        ORDER BY center_name
    """
    try:
        rows = list(client.query(q).result())
        return {"centers": [r.center_name for r in rows]}
    except Exception as e:
        return {"error": str(e), "centers": []}

@app.get("/api/appointment_centers")
def list_appointment_centers():
    table = get_appt_table()
    q = f"""
        SELECT DISTINCT center_name
        FROM {table}
        WHERE center_name IS NOT NULL AND TRIM(center_name) != ''
        ORDER BY center_name
    """
    try:
        rows = list(client.query(q).result())
        return {"centers": [r.center_name for r in rows]}
    except Exception as e:
        return {"error": str(e), "centers": []}

# ─────────────────────────────────────────────────────────────────────────────
# REVENUE
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/api/revenue")
async def revenue(request: Request):
    body = await request.json()
    if isinstance(body, list): body = body[0] if body else {}

    action = str(body.get("action", "summary")).lower()
    month  = body.get("month") or current_month()
    center = body.get("center", None)
    table  = get_table()

    start_str, end_str = get_month_bounds(month)
    today_date    = min(date.today(), datetime.strptime(end_str, "%Y-%m-%d").date())
    today         = str(today_date)
    start_date    = datetime.strptime(start_str, "%Y-%m-%d").date()
    days_elapsed  = (today_date - start_date).days + 1
    days_in_month = (datetime.strptime(end_str, "%Y-%m-%d").date() - start_date).days + 1

    CENTER = build_center_clause(center)
    BASE   = f"DATE(invoice_closed_date) BETWEEN '{{start}}' AND '{{end}}' AND status = 'Closed'{CENTER}"

    try:
        if action == "summary":
            q = f"""
                SELECT COALESCE(SUM({REV}), 0) AS mtd_revenue
                FROM {table}
                WHERE {BASE.format(start=start_str, end=today)}
            """
            mtd          = to_float(list(client.query(q).result())[0].mtd_revenue)
            rev_per_day  = mtd / days_elapsed if days_elapsed > 0 else 0
            projected    = rev_per_day * days_in_month
            rev_per_hour = rev_per_day / 10

            q_adv = f"""
                SELECT COALESCE(AVG(daily), 0) AS adv FROM (
                    SELECT DATE(invoice_closed_date) AS d, SUM({REV}) AS daily
                    FROM {table}
                    WHERE DATE(invoice_closed_date)
                          BETWEEN DATE_SUB('{today}', INTERVAL 30 DAY) AND '{today}'
                        AND status = 'Closed'{CENTER}
                    GROUP BY d
                )
            """
            adv  = to_float(list(client.query(q_adv).result())[0].adv)
            yest = str(today_date - timedelta(days=1))
            q_y  = f"""
                SELECT COALESCE(SUM({REV}), 0) AS yest FROM {table}
                WHERE DATE(invoice_closed_date) = '{yest}' AND status = 'Closed'{CENTER}
            """
            yesterday_rev = to_float(list(client.query(q_y).result())[0].yest)
            goal          = float(os.getenv("MONTHLY_GOAL", "0"))

            return {
                "mtd_revenue": mtd, "projected": projected,
                "rev_per_day": rev_per_day, "rev_per_hour": rev_per_hour,
                "adv": adv, "yesterday_revenue": yesterday_rev,
                "days_elapsed": days_elapsed, "days_in_month": days_in_month,
                "goal": goal,
            }

        elif action == "daily":
            q = f"""
                SELECT DATE(invoice_closed_date) AS day, SUM({REV}) AS daily_revenue
                FROM {table}
                WHERE {BASE.format(start=start_str, end=end_str)}
                GROUP BY day ORDER BY day
            """
            rows = list(client.query(q).result())
            goal         = float(os.getenv("MONTHLY_GOAL", "0"))
            goal_per_day = goal / days_in_month if goal > 0 else 0
            data, cumulative = [], 0
            for i, row in enumerate(rows):
                cumulative += to_float(row.daily_revenue)
                data.append({
                    "date": str(row.day), "daily_revenue": to_float(row.daily_revenue),
                    "mtd_cumulative": cumulative, "goal_mtd": goal_per_day * (i + 1),
                })
            return {"data": data, "goal": goal}

        elif action == "categories":
            q = f"""
                SELECT
                    COALESCE(NULLIF(TRIM(item_sub_category),''),
                             NULLIF(TRIM(item_category),''), 'Other') AS category,
                    SUM({REV}) AS revenue
                FROM {table}
                WHERE {BASE.format(start=start_str, end=today)}
                GROUP BY category HAVING revenue > 0 ORDER BY revenue DESC
            """
            rows  = list(client.query(q).result())
            total = sum(to_float(r.revenue) for r in rows)
            return {
                "data": [{"category": r.category, "revenue": to_float(r.revenue),
                           "percentage": round(to_float(r.revenue)/total*100,1) if total>0 else 0}
                         for r in rows],
                "total": total,
            }

        elif action == "weekly":
            q = f"""
                SELECT DATE(invoice_closed_date) AS day, SUM({REV}) AS daily_revenue
                FROM {table}
                WHERE {BASE.format(start=start_str, end=today)}
                GROUP BY day ORDER BY day
            """
            rows  = list(client.query(q).result())
            daily = {str(r.day): to_float(r.daily_revenue) for r in rows}
            weeks = []
            for week_num in range(4):
                week_start = start_date + timedelta(days=week_num * 7)
                total = sum(daily.get(str(week_start + timedelta(days=d)), 0) for d in range(7))
                weeks.append({"week": f"Week {week_num + 1}", "revenue": total})
            for i, week in enumerate(weeks):
                prev = weeks[i-1]["revenue"] if i > 0 else 0
                week["wow"] = None if i == 0 or prev == 0 else round((week["revenue"]-prev)/prev*100, 2)
            return {"weeks": weeks, "full_month_pace": sum(w["revenue"] for w in weeks)}

        else:
            return {"error": f"Unknown action: {action}"}

    except Exception as e:
        return {"error": str(e)}

# ─────────────────────────────────────────────────────────────────────────────
# LEADERBOARD
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/api/leaderboard")
async def leaderboard(request: Request):
    body = await request.json()
    if isinstance(body, list): body = body[0] if body else {}

    action = str(body.get("action", "staff")).lower()
    month  = body.get("month") or current_month()
    center = body.get("center", None)
    table  = get_table()

    start_str, end_str = get_month_bounds(month)
    today_date = min(date.today(), datetime.strptime(end_str, "%Y-%m-%d").date())
    today      = str(today_date)
    CENTER     = build_center_clause(center)
    BASE       = f"DATE(invoice_closed_date) BETWEEN '{{start}}' AND '{{end}}' AND status = 'Closed'{CENTER}"

    try:
        if action == "staff":
            q = f"""
                SELECT
                    COALESCE(NULLIF(TRIM(sold_by),''), 'Unknown') AS staff,
                    SUM({REV}) AS revenue,
                    COUNT(DISTINCT row_id) AS invoice_count,
                    SUM(qty) AS units_sold,
                    SAFE_DIVIDE(SUM({REV}), COUNT(DISTINCT row_id)) AS avg_ticket
                FROM {table}
                WHERE {BASE.format(start=start_str, end=today)}
                GROUP BY staff HAVING revenue > 0 ORDER BY revenue DESC LIMIT 20
            """
            rows  = list(client.query(q).result())
            total = sum(to_float(r.revenue) for r in rows)
            data  = []
            for i, r in enumerate(rows):
                rev = to_float(r.revenue)
                data.append({
                    "rank": i+1, "staff": r.staff, "revenue": rev,
                    "share": round(rev/total*100,1) if total>0 else 0,
                    "invoice_count": int(r.invoice_count or 0),
                    "units_sold": to_float(r.units_sold),
                    "avg_ticket": to_float(r.avg_ticket),
                })
            return {"data": data, "total": total}

        elif action == "staff_trend":
            top_n  = int(body.get("top_n", 5))
            q_top  = f"""
                SELECT COALESCE(NULLIF(TRIM(sold_by),''), 'Unknown') AS staff,
                       SUM({REV}) AS revenue
                FROM {table}
                WHERE {BASE.format(start=start_str, end=today)}
                GROUP BY staff HAVING revenue > 0 ORDER BY revenue DESC LIMIT {top_n}
            """
            top_rows  = list(client.query(q_top).result())
            top_staff = [r.staff for r in top_rows]
            if not top_staff: return {"data": []}
            staff_list = ", ".join(f"'{s.replace(chr(39), chr(39)+chr(39))}'" for s in top_staff)
            q = f"""
                SELECT COALESCE(NULLIF(TRIM(sold_by),''), 'Unknown') AS staff,
                       DATE(invoice_closed_date) AS day, SUM({REV}) AS revenue
                FROM {table}
                WHERE {BASE.format(start=start_str, end=today)}
                  AND COALESCE(NULLIF(TRIM(sold_by),''), 'Unknown') IN ({staff_list})
                GROUP BY staff, day ORDER BY staff, day
            """
            rows     = list(client.query(q).result())
            by_staff = {}
            for r in rows:
                by_staff.setdefault(r.staff, []).append({"date": str(r.day), "revenue": to_float(r.revenue)})
            return {"data": [{"staff": s, "trend": by_staff[s]} for s in top_staff if s in by_staff]}

        elif action == "service_types":
            q = f"""
                SELECT COALESCE(NULLIF(TRIM(serviced_by),''), 'N/A') AS servicer,
                       SUM({REV}) AS revenue, COUNT(DISTINCT row_id) AS invoices
                FROM {table}
                WHERE {BASE.format(start=start_str, end=today)}
                GROUP BY servicer HAVING revenue > 0 ORDER BY revenue DESC LIMIT 15
            """
            rows  = list(client.query(q).result())
            total = sum(to_float(r.revenue) for r in rows)
            return {
                "data": [{"servicer": r.servicer, "revenue": to_float(r.revenue),
                           "invoices": int(r.invoices or 0),
                           "share": round(to_float(r.revenue)/total*100,1) if total>0 else 0}
                         for r in rows],
                "total": total,
            }

        elif action == "referrals":
            q = f"""
                SELECT COALESCE(NULLIF(TRIM(referral_source),''), 'Not specified') AS source,
                       COUNT(DISTINCT row_id) AS count, SUM({REV}) AS revenue
                FROM {table}
                WHERE {BASE.format(start=start_str, end=today)}
                GROUP BY source ORDER BY count DESC LIMIT 10
            """
            rows  = list(client.query(q).result())
            total = sum(int(r.count or 0) for r in rows)
            return {
                "data": [{"source": r.source, "count": int(r.count or 0),
                           "revenue": to_float(r.revenue),
                           "share": round(int(r.count or 0)/total*100,1) if total>0 else 0}
                         for r in rows],
                "total": total,
            }

        else:
            return {"error": f"Unknown action: {action}"}

    except Exception as e:
        return {"error": str(e)}

# ─────────────────────────────────────────────────────────────────────────────
# APPOINTMENTS
# Confirmed from sample data:
#   - status values: Closed | Deleted | Closed (No Show) | Cancelled | Open
#   - Deleted = system artifact (duplicate/incorrect) → EXCLUDED from all counts
#   - start_time is TIMESTAMP (not TIME)
#   - actual_duration is TIME
#   - scheduled_service_and_recovery_duration is TIME
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/api/appointments")
async def appointments(request: Request):
    body = await request.json()
    if isinstance(body, list): body = body[0] if body else {}

    action = str(body.get("action", "summary")).lower()
    month  = body.get("month") or current_month()
    center = body.get("center", None)
    table  = get_appt_table()

    start_str, end_str = get_month_bounds(month)
    today_date    = min(date.today(), datetime.strptime(end_str, "%Y-%m-%d").date())
    today         = str(today_date)
    start_date    = datetime.strptime(start_str, "%Y-%m-%d").date()
    days_elapsed  = (today_date - start_date).days + 1
    days_in_month = (datetime.strptime(end_str, "%Y-%m-%d").date() - start_date).days + 1
    CENTER        = build_center_clause(center)

    # Base date filter — always exclude Deleted
    BASE_DATE = f"appointment_date BETWEEN '{start_str}' AND '{today}' AND status != 'Deleted'{CENTER}"

    try:

        # ── SUMMARY ──────────────────────────────────────────────────────────
        if action == "summary":
            # IMPORTANT: Based on the schema provided, `actual_duration` and
            # `scheduled_service_and_recovery_duration` are INTEGER types (likely minutes).
            # Using TIME_DIFF on them causes an error. They should be used directly.
            # ASSUMPTION: `actual_duration` exists in the table and is INTEGER minutes.
            # If `actual_duration` does not exist, AVG(...) will return NULL.
            q = f"""
                SELECT
                    COUNT(*)                                    AS total_appointments,
                    COUNTIF(status = 'Closed')                  AS closed,
                    COUNTIF(status = 'Closed (No Show)')        AS noshows,
                    COUNTIF(status = 'Cancelled')               AS cancelled,
                    COUNTIF(rebooked = TRUE)                    AS rebooked,
                    COUNTIF(first_visit = TRUE)                 AS first_visits,
                    COUNTIF(surprise_visit = TRUE)              AS surprise_visits,
                    -- actual_duration assumed INTEGER (minutes), use directly
                    AVG(
                        CASE WHEN actual_duration IS NOT NULL
                             THEN actual_duration
                        END
                    )                                           AS avg_actual_min,
                    -- scheduled duration assumed INTEGER (minutes), use directly
                    SUM(
                        CASE WHEN status = 'Closed'
                               AND scheduled_service_and_recovery_duration IS NOT NULL
                             THEN scheduled_service_and_recovery_duration
                        END
                    )                                           AS total_scheduled_min
                FROM {table}
                WHERE {BASE_DATE}
            """
            rows = list(client.query(q).result())
            r    = rows[0]

            total_appts = int(r.total_appointments or 0)
            closed      = int(r.closed or 0)
            noshows     = int(r.noshows or 0)
            cancelled   = int(r.cancelled or 0)
            # Capacity: days_elapsed × 10 operating hours × 60 min
            cap_min   = days_elapsed * 10 * 60
            sched_min = to_float(r.total_scheduled_min)

            return {
                "total_appointments":      total_appts,
                "closed":                  closed,
                "noshows":                 noshows,
                "cancelled":               cancelled,
                "avg_per_day":             round(total_appts / days_elapsed, 1) if days_elapsed else 0,
                "surprise_visits":         int(r.surprise_visits or 0),
                "noshow_rate":             round(noshows / total_appts * 100, 1) if total_appts else 0,
                "cancel_rate":             round(cancelled / total_appts * 100, 1) if total_appts else 0,
                "utilisation_pct":         round(sched_min / cap_min * 100, 1) if cap_min else 0,
                "avg_actual_duration_min": round(to_float(r.avg_actual_min)) if r.avg_actual_min else "—",
                # services_per_appt not meaningful here since each row = 1 service
                "total_services":          total_appts,
                "services_per_appt":       1,
            }

        # ── DAILY ────────────────────────────────────────────────────────────
        elif action == "daily":
            q = f"""
                SELECT
                    appointment_date,
                    COUNT(*) AS count
                FROM {table}
                WHERE {BASE_DATE}
                GROUP BY appointment_date ORDER BY appointment_date
            """
            rows = list(client.query(q).result())
            cumulative, data = 0, []
            for r in rows:
                cumulative += int(r.count or 0)
                data.append({
                    "date":       str(r.appointment_date),
                    "count":      int(r.count or 0),
                    "cumulative": cumulative
                })
            return {"data": data}

        # ── BY STATUS ────────────────────────────────────────────────────────
        elif action == "by_status":
            q = f"""
                SELECT COALESCE(status,'Unknown') AS status, COUNT(*) AS count
                FROM {table}
                WHERE {BASE_DATE}
                GROUP BY status ORDER BY count DESC
            """
            rows  = list(client.query(q).result())
            total = sum(int(r.count or 0) for r in rows)
            return {"data": [{"status": r.status, "count": int(r.count or 0),
                               "pct": round(int(r.count or 0)/total*100,1) if total else 0}
                              for r in rows]}

        # ── BY CATEGORY ──────────────────────────────────────────────────────
        elif action == "by_category":
            # service_category confirmed: Injectables, Consults, Facials,
            # Skin Rejuvenation, Body Contouring, Laser Hair Removal
            q = f"""
                SELECT
                    COALESCE(NULLIF(TRIM(service_category),''), 'Uncategorised') AS category,
                    COUNT(*) AS count
                FROM {table}
                WHERE {BASE_DATE} AND status = 'Closed'
                GROUP BY category ORDER BY count DESC LIMIT 10
            """
            rows  = list(client.query(q).result())
            total = sum(int(r.count or 0) for r in rows)
            return {"data": [{"category": r.category, "count": int(r.count or 0),
                               "pct": round(int(r.count or 0)/total*100,1) if total else 0}
                              for r in rows]}

        # ── BY PROVIDER ──────────────────────────────────────────────────────
        elif action == "by_provider":
            # providers field confirmed: Crystal Farinha, Karen Enriquez, Daylin Bastidas, etc.
            q = f"""
                SELECT
                    COALESCE(NULLIF(TRIM(providers),''), 'Unassigned') AS provider,
                    COUNT(*) AS count,
                    COUNTIF(status = 'Closed') AS closed_count
                FROM {table}
                WHERE {BASE_DATE}
                GROUP BY provider ORDER BY count DESC LIMIT 15
            """
            rows  = list(client.query(q).result())
            total = sum(int(r.count or 0) for r in rows)
            return {"data": [{"provider": r.provider, "count": int(r.count or 0),
                               "closed_count": int(r.closed_count or 0),
                               "pct": round(int(r.count or 0)/total*100,1) if total else 0}
                              for r in rows]}

        # ── BY BOOKING SOURCE ────────────────────────────────────────────────
        elif action == "by_booking_source":
            # booking_source confirmed: POS, Online, Zenoti, null
            q = f"""
                SELECT
                    COALESCE(NULLIF(TRIM(booking_source),''), 'Unknown') AS source,
                    COUNT(*) AS count
                FROM {table}
                WHERE {BASE_DATE}
                GROUP BY source ORDER BY count DESC LIMIT 12
            """
            rows  = list(client.query(q).result())
            total = sum(int(r.count or 0) for r in rows)
            return {"data": [{"source": r.source, "count": int(r.count or 0),
                               "pct": round(int(r.count or 0)/total*100,1) if total else 0}
                              for r in rows]}

        # ── BY HOUR ──────────────────────────────────────────────────────────
        elif action == "by_hour":
            # start_time is TIMESTAMP — extract hour directly
            q = f"""
                SELECT
                    EXTRACT(HOUR FROM start_time AT TIME ZONE 'America/New_York') AS hour,
                    COUNT(*) AS count
                FROM {table}
                WHERE {BASE_DATE}
                  AND status = 'Closed'
                  AND start_time IS NOT NULL
                GROUP BY hour ORDER BY hour
            """
            rows = list(client.query(q).result())
            return {"data": [{"hour": int(r.hour), "count": int(r.count or 0)} for r in rows]}

        # ── REBOOK RATE ──────────────────────────────────────────────────────
        elif action == "rebook_rate":
            # add_on confirmed: 'Yes', 'No', null
            q = f"""
                SELECT
                    COUNT(*)                                AS total,
                    COUNTIF(status = 'Closed')             AS closed,
                    COUNTIF(rebooked = TRUE)               AS rebooked,
                    COUNTIF(first_visit = TRUE)            AS first_visits,
                    COUNTIF(surprise_visit = TRUE)         AS surprise_total,
                    COUNTIF(UPPER(TRIM(COALESCE(add_on,''))) = 'YES') AS addons
                FROM {table}
                WHERE {BASE_DATE}
            """
            rows   = list(client.query(q).result())
            r      = rows[0]
            closed = int(r.closed or 0)
            rb     = int(r.rebooked or 0)
            fv     = int(r.first_visits or 0)
            return {
                "total":            int(r.total or 0),
                "closed":           closed,
                "rebooked":         rb,
                "first_visits":     fv,
                "surprise_total":   int(r.surprise_total or 0),
                "addons":           int(r.addons or 0),
                "rebook_rate":      round(rb / closed * 100, 1) if closed else 0,
                "first_visit_rate": round(fv / closed * 100, 1) if closed else 0,
            }

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
                WHERE {BASE_DATE}
                GROUP BY appointment_date ORDER BY appointment_date
            """
            rows  = list(client.query(q).result())
            daily = {
                str(r.appointment_date): {
                    "total":    int(r.total or 0),
                    "closed":   int(r.closed or 0),
                    "noshows":  int(r.noshows or 0),
                    "cancelled":int(r.cancelled or 0),
                }
                for r in rows
            }
            weeks = []
            for week_num in range(4):
                week_start = start_date + timedelta(days=week_num * 7)
                totals = {"total": 0, "closed": 0, "noshows": 0, "cancelled": 0}
                for d in range(7):
                    day_str = str(week_start + timedelta(days=d))
                    for k in totals:
                        totals[k] += daily.get(day_str, {}).get(k, 0)
                weeks.append({"week": f"Week {week_num+1}", **totals})
            for i, week in enumerate(weeks):
                prev = weeks[i-1]["total"] if i > 0 else 0
                week["wow"] = None if i == 0 or prev == 0 else round(
                    (week["total"]-prev)/prev*100, 2
                )
            return {"weeks": weeks}

        else:
            return {"error": f"Unknown action: {action}"}

    except Exception as e:
        return {"error": str(e)}


# ─── Legacy endpoint ──────────────────────────────────────────────────────────
@app.post("/api/dashboard")
async def dashboard(request: Request):
    return await revenue(request)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
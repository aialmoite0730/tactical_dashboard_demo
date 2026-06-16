import os
import base64
import json
import tempfile
import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta
from google.cloud import bigquery
from dotenv import load_dotenv

load_dotenv()

# ─── Thread pool for async BigQuery calls ─────────────────────────────────────
# BigQuery client is synchronous; we run queries in a thread pool so they
# don't block FastAPI's async event loop.
_executor = ThreadPoolExecutor(max_workers=10)


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

# ─── BigQuery client (singleton) ─────────────────────────────────────────────
client = bigquery.Client()


# ─── Table references ─────────────────────────────────────────────────────────
def get_sales_table() -> str:
    project = os.getenv("BIGQUERY_PROJECT_ID", "your-project")
    dataset = os.getenv("BIGQUERY_DATASET",    "your_dataset")
    table   = os.getenv("BIGQUERY_TABLE",      "sales_accrual")
    return f"`{project}.{dataset}.{table}`"


def get_appt_table() -> str:
    project = os.getenv("BIGQUERY_PROJECT_ID")
    dataset = os.getenv("BIGQUERY_DATASET")
    table   = os.getenv("BIGQUERY_APPT_TABLE")
    return f"`{project}.{dataset}.{table}`"


def get_schedule_table() -> str:
    project = os.getenv("BIGQUERY_PROJECT_ID")
    dataset = os.getenv("BIGQUERY_DATASET")
    table   = os.getenv("BIGQUERY_SCHEDULE_TABLE", "employee_schedule")
    return f"`{project}.{dataset}.{table}`"


# ─── Date helpers ─────────────────────────────────────────────────────────────
def current_month() -> str:
    return date.today().strftime("%Y-%m")


def get_month_bounds(month_str: str) -> tuple[str, str]:
    target = datetime.strptime(month_str, "%Y-%m").date()
    start  = target.replace(day=1)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1, day=1) - timedelta(days=1)
    else:
        end = start.replace(month=start.month + 1, day=1) - timedelta(days=1)
    return str(start), str(end)


def month_context(month_str: str) -> dict:
    """Returns commonly needed date values for a given month string."""
    start_str, end_str = get_month_bounds(month_str)
    end_date   = datetime.strptime(end_str, "%Y-%m-%d").date()
    today_date = min(date.today(), end_date)
    start_date = datetime.strptime(start_str, "%Y-%m-%d").date()
    days_elapsed  = (today_date - start_date).days + 1
    days_in_month = (end_date - start_date).days + 1
    return {
        "start_str":     start_str,
        "end_str":       end_str,
        "today":         str(today_date),
        "today_date":    today_date,
        "start_date":    start_date,
        "days_elapsed":  days_elapsed,
        "days_in_month": days_in_month,
    }


# ─── Query helpers ────────────────────────────────────────────────────────────
def to_float(val) -> float:
    return 0.0 if val is None else float(val)


def build_center_clause(center: str | None, field: str = "center_name") -> str:
    if center and center.strip() and center.strip().lower() != "all":
        safe = center.replace("'", "''")
        return f" AND {field} = '{safe}'"
    return ""


def run_query(sql: str) -> list:
    """Synchronous BigQuery query. Prefer run_query_async inside async endpoints."""
    return list(client.query(sql).result())


async def run_query_async(sql: str) -> list:
    """
    Non-blocking BigQuery query for use inside async FastAPI endpoints.
    Runs the synchronous BigQuery call in a thread pool so it never
    blocks the event loop — multiple queries can execute concurrently
    via asyncio.gather().
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_executor, run_query, sql)
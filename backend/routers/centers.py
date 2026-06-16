"""
/api/centers            – distinct centers from sales_accrual
/api/appointment_centers – distinct centers from appointments
"""

from fastapi import APIRouter
from utils.errors import error_response
from core.config import get_sales_table, get_appt_table, run_query

router = APIRouter(tags=["Centers"])


@router.get("/api/centers")
def list_sales_centers():
    table = get_sales_table()
    q = f"""
        SELECT DISTINCT center_name
        FROM {table}
        WHERE center_name IS NOT NULL AND TRIM(center_name) != ''
        ORDER BY center_name
    """
    try:
        rows = run_query(q)
        return {"centers": [r.center_name for r in rows]}
    except Exception as e:
        return {"centers": [], **error_response(e)}


@router.get("/api/appointment_centers")
def list_appointment_centers():
    table = get_appt_table()
    q = f"""
        SELECT DISTINCT center_name
        FROM {table}
        WHERE center_name IS NOT NULL AND TRIM(center_name) != ''
        ORDER BY center_name
    """
    try:
        rows = run_query(q)
        return {"centers": [r.center_name for r in rows]}
    except Exception as e:
        return {"centers": [], **error_response(e)}
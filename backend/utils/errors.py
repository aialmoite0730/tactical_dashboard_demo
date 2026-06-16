"""
utils/errors.py
───────────────
Centralised error handling for all API routers.

All endpoints follow the same contract:
    return error_response(e)

which produces:
    { "error": "<message>", "type": "<ExceptionClassName>" }

For HTTP-specific errors (e.g. bad request, not found), raise an
HTTPException directly — FastAPI handles those natively.
"""

from __future__ import annotations

import traceback
from typing import Any


def error_response(exc: Exception, *, debug: bool = False) -> dict[str, Any]:
    """
    Return a consistent error dict instead of letting the exception bubble up.

    Args:
        exc:   The caught exception.
        debug: If True, include the full traceback in the response.
               Leave False in production — never expose stack traces to clients.

    Returns:
        { "error": str, "type": str }          (debug=False)
        { "error": str, "type": str,
          "traceback": str }                    (debug=True)
    """
    payload: dict[str, Any] = {
        "error": str(exc),
        "type":  type(exc).__name__,
    }
    if debug:
        payload["traceback"] = traceback.format_exc()
    return payload
"""
AI Insights
===========
POST /api/insights

The frontend (AiInsights.jsx) builds the full prompt client-side and sends
it here. This router calls OpenAI (gpt-4o-mini) first, falling back to
Gemini (gemini-flash-latest) if OpenAI is not configured or fails.

Register in main.py:
    from routers.insights import router as insights_router
    app.include_router(insights_router)

Required env vars (server-side only):
    OPENAI_API_KEY   (optional — primary provider)
    GEMINI_API_KEY   (optional — fallback provider)
"""

import os
from typing import Optional

import httpx
from fastapi import APIRouter, Request
from pydantic import BaseModel
from utils.errors import error_response

router = APIRouter(tags=["AI Insights"])

_ENV = os.getenv("APP_ENV", "production")

# ─── AI provider config ────────────────────────────────────────────────────────
OPENAI_URL   = "https://api.openai.com/v1/chat/completions"
OPENAI_MODEL = "gpt-4o-mini"
GEMINI_URL   = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent"

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

AI_TIMEOUT_SECONDS = 30.0

# ─── Debug logging ─────────────────────────────────────────────────────────────
# Set AI_INSIGHTS_DEBUG=0 to silence. On by default — easy to misconfigure.
DEBUG = os.getenv("AI_INSIGHTS_DEBUG", "1") != "0"


def _debug(msg: str) -> None:
    if DEBUG:
        print(f"🔍 [insights] {msg}")


_debug(
    f"startup — OPENAI_API_KEY={'set (' + OPENAI_API_KEY[:4] + '...)' if OPENAI_API_KEY else 'NOT SET'}, "
    f"GEMINI_API_KEY={'set (' + GEMINI_API_KEY[:4] + '...)' if GEMINI_API_KEY else 'NOT SET'}"
)


# ─── Request model ─────────────────────────────────────────────────────────────
class InsightRequest(BaseModel):
    tab:        str
    prompt:     str
    month:      Optional[str] = None
    center:     Optional[str] = None


# ─── AI provider calls ─────────────────────────────────────────────────────────
async def _call_openai(prompt: str) -> str:
    _debug(f"calling OpenAI ({OPENAI_MODEL}) — prompt length={len(prompt)} chars")
    async with httpx.AsyncClient(timeout=AI_TIMEOUT_SECONDS) as client:
        res = await client.post(
            OPENAI_URL,
            headers={
                "Content-Type":  "application/json",
                "Authorization": f"Bearer {OPENAI_API_KEY}",
            },
            json={
                "model":       OPENAI_MODEL,
                "messages":    [{"role": "user", "content": prompt}],
                "temperature": 0.2,
                "max_tokens":  600,
            },
        )

    _debug(f"OpenAI responded with HTTP {res.status_code}")
    if res.status_code != 200:
        try:    err = res.json()
        except: err = {}
        _debug(f"OpenAI error body: {err}")
        if res.status_code == 429:
            raise RuntimeError("OpenAI rate limit reached.")
        raise RuntimeError(err.get("error", {}).get("message") or f"OpenAI HTTP {res.status_code}")

    data = res.json()
    text = (data.get("choices", [{}])[0].get("message", {}).get("content") or "").strip()
    _debug(f"OpenAI returned {len(text)} chars")
    return text


async def _call_gemini(prompt: str) -> str:
    _debug(f"calling Gemini (fallback) — prompt length={len(prompt)} chars")
    async with httpx.AsyncClient(timeout=AI_TIMEOUT_SECONDS) as client:
        res = await client.post(
            GEMINI_URL,
            headers={
                "Content-Type":   "application/json",
                "X-goog-api-key": GEMINI_API_KEY,
            },
            json={
                "contents":         [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.2, "maxOutputTokens": 600},
            },
        )

    _debug(f"Gemini responded with HTTP {res.status_code}")
    if res.status_code != 200:
        try:    err = res.json()
        except: err = {}
        _debug(f"Gemini error body: {err}")
        if res.status_code == 429:
            raise RuntimeError("Gemini rate limit reached.")
        raise RuntimeError(err.get("error", {}).get("message") or f"Gemini HTTP {res.status_code}")

    data  = res.json()
    parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])
    text  = (parts[0].get("text") or "").strip()
    _debug(f"Gemini returned {len(text)} chars")
    return text


# ─── Route ─────────────────────────────────────────────────────────────────────
@router.post("/api/insights")
async def get_insight(payload: InsightRequest, request: Request):
    """
    Returns: { "insight": str, "provider": "openai" | "gemini" }
    """
    try:
        _debug(
            f"request received — tab={payload.tab}, month={payload.month}, "
            f"center={payload.center}, prompt_length={len(payload.prompt)}"
        )

        if not OPENAI_API_KEY and not GEMINI_API_KEY:
            raise RuntimeError(
                "No AI provider configured on the server "
                "(set OPENAI_API_KEY and/or GEMINI_API_KEY)."
            )

        text     = ""
        provider = None
        last_err = None

        # OpenAI first
        if OPENAI_API_KEY:
            try:
                text     = await _call_openai(payload.prompt)
                provider = "openai"
            except Exception as exc:
                _debug(f"OpenAI FAILED: {exc!r}")
                last_err = exc
        else:
            _debug("OPENAI_API_KEY not set — skipping primary provider")

        # Gemini fallback
        if not text and GEMINI_API_KEY:
            try:
                text     = await _call_gemini(payload.prompt)
                provider = "gemini"
                last_err = None
            except Exception as exc:
                _debug(f"Gemini FAILED: {exc!r}")
                last_err = exc
        elif not text:
            _debug("GEMINI_API_KEY not set — no fallback available")

        if not text:
            _debug(f"both providers failed — raising: {last_err!r}")
            raise last_err or RuntimeError("AI provider returned an empty response.")

        _debug(f"success via {provider} — insight length={len(text)} chars")
        return {"insight": text, "provider": provider}

    except Exception as exc:
        _debug(f"request FAILED: {exc!r}")
        return error_response(exc)
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

# ─── AI provider config ────────────────────────────────────────────────────────
OPENAI_URL   = "https://api.openai.com/v1/chat/completions"
OPENAI_MODEL = "gpt-4o-mini"
GEMINI_URL   = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent"

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

AI_TIMEOUT_SECONDS = 30.0


# ─── Request model ─────────────────────────────────────────────────────────────
class InsightRequest(BaseModel):
    tab:        str
    prompt:     str
    month:      Optional[str] = None
    center:     Optional[str] = None


# ─── AI provider calls ─────────────────────────────────────────────────────────
async def _call_openai(prompt: str) -> str:
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

    if res.status_code != 200:
        try:    err = res.json()
        except: err = {}
        if res.status_code == 429:
            raise RuntimeError("OpenAI rate limit reached.")
        raise RuntimeError(err.get("error", {}).get("message") or f"OpenAI HTTP {res.status_code}")

    data = res.json()
    text = (data.get("choices", [{}])[0].get("message", {}).get("content") or "").strip()
    return text


async def _call_gemini(prompt: str) -> str:
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

    if res.status_code != 200:
        try:    err = res.json()
        except: err = {}
        if res.status_code == 429:
            raise RuntimeError("Gemini rate limit reached.")
        raise RuntimeError(err.get("error", {}).get("message") or f"Gemini HTTP {res.status_code}")

    data  = res.json()
    parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])
    text  = (parts[0].get("text") or "").strip()
    return text


# ─── Route ─────────────────────────────────────────────────────────────────────
@router.post("/api/insights")
async def get_insight(payload: InsightRequest, request: Request):
    """
    Returns: { "insight": str, "provider": "openai" | "gemini" }
    """
    try:
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
                last_err = exc

        # Gemini fallback
        if not text and GEMINI_API_KEY:
            try:
                text     = await _call_gemini(payload.prompt)
                provider = "gemini"
                last_err = None
            except Exception as exc:
                last_err = exc

        if not text:
            raise last_err or RuntimeError("AI provider returned an empty response.")

        return {"insight": text, "provider": provider}

    except Exception as exc:
        return error_response(exc)
"""
Tactical Dashboard API — modular entry point.

Router map:
  /api/centers             → routers/centers.py
  /api/appointment_centers → routers/centers.py
  /api/revenue             → routers/revenue.py
  /api/dashboard           → routers/revenue.py  (legacy alias)
  /api/leaderboard         → routers/leaderboard.py
  /api/appointments        → routers/appointments.py
  /api/utilization         → routers/utilization.py
  /api/marketing           → routers/marketing.py
  /api/insights            → routers/insights.py
"""

import os
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env file if present (pip install python-dotenv)
try:
    from dotenv import load_dotenv
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path)
    else:
        load_dotenv()
except ImportError:
    pass

from routers.centers      import router as centers_router
from routers.revenue      import router as revenue_router
from routers.leaderboard  import router as leaderboard_router
from routers.appointments import router as appointments_router
from routers.utilization  import router as utilization_router
from routers.marketing    import router as marketing_router
from routers.insights     import router as insights_router

app = FastAPI(title="Tactical Dashboard API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(centers_router)
app.include_router(revenue_router)
app.include_router(leaderboard_router)
app.include_router(appointments_router)
app.include_router(utilization_router)
app.include_router(marketing_router)
app.include_router(insights_router)


@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
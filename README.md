# Evolve SPA Dashboard

A single-page tactical dashboard for revenue, leaderboard, and appointment analytics.

The app is split into:
- `backend/` — FastAPI Python service querying BigQuery
- `frontend/` — React SPA with charts and filters

## Project Structure

```
evolve_spa_dashboard/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── Procfile
│   └── railway.json
├── frontend/
│   ├── package.json
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── App.js
│       ├── App.css
│       ├── components/
│       │   ├── Appointments.jsx
│       │   ├── Leaderboard.jsx
│       │   └── Revenue.jsx
│       ├── hooks/
│       │   └── useDashboard.js
│       └── utils/
│           ├── api.js
│           └── format.js
└── README.md
```

## Features

- Revenue KPIs, projection, daily performance, category breakdown, and weekly pace
- Staff leaderboard, service type revenue, and referral source analytics
- Appointment analytics by status, category, provider, booking source, hourly distribution, and rebook rate
- Center-level filtering for revenue and appointments
- Uses BigQuery data for live dashboard metrics

## Local Development

### Backend

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create a local env file in `backend/` (for example `.env`) with the variables below.

Run the backend:

```bash
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm start
```

The frontend expects `REACT_APP_API_URL` to point to the backend, for example `http://localhost:8000`.

## Backend Environment Variables

The backend reads credentials and BigQuery settings from environment variables.

| Variable | Required | Description |
|---|---|---|
| `BIGQUERY_PROJECT_ID` | ✅ | GCP project ID |
| `BIGQUERY_DATASET` | ✅ | BigQuery dataset name |
| `BIGQUERY_TABLE` | ✅ | Default table name is `sales_accrual` |
| `BIGQUERY_APPT_TABLE` | ✅ | Appointment table used by `appointments` API |
| `GOOGLE_APPLICATION_CREDENTIALS` | ✅ local | Path to your BigQuery service account JSON file |
| `BIGQUERY_CREDENTIALS_BASE64` | ✅ deployment | Base64-encoded JSON service account content |
| `MONTHLY_GOAL` | optional | Numeric revenue goal for dashboard progress |
| `PORT` | optional | Backend port, defaults to `8000` |

> ⚠️ Do not commit service account keys or `.env` files to version control.

## API Endpoints

### Health
- `GET /health`

### Center data
- `GET /api/centers` — revenue center list
- `GET /api/appointment_centers` — appointment center list

### Revenue APIs
- `POST /api/revenue`
  - body: `{ action, month, center }`
  - supported actions: `summary`, `daily`, `categories`, `weekly`
- `POST /api/dashboard` — alias for `/api/revenue`

### Leaderboard APIs
- `POST /api/leaderboard`
  - body: `{ action, month, center }`
  - supported actions: `staff`, `service_types`, `referrals`, `staff_trend`

### Appointment APIs
- `POST /api/appointments`
  - body: `{ action, month, center }`
  - supported actions: `summary`, `daily`, `by_status`, `by_category`, `by_provider`, `by_booking_source`, `by_hour`, `rebook_rate`

## Deployment Notes

- `backend/Procfile` is configured for a Python FastAPI deploy.
- `frontend/package.json` includes `start`, `build`, and `serve` scripts.
- For cloud deployment, set credentials using `BIGQUERY_CREDENTIALS_BASE64` instead of a local JSON file.

## Quick Start

1. Configure backend env vars.
2. Start the backend on `http://localhost:8000`.
3. Set `REACT_APP_API_URL=http://localhost:8000` in frontend environment.
4. Start the frontend with `npm start`.

## Useful Commands

- Backend install: `pip install -r backend/requirements.txt`
- Backend run: `uvicorn backend.main:app --reload --port 8000`
- Frontend install: `cd frontend && npm install`
- Frontend run: `cd frontend && npm start`

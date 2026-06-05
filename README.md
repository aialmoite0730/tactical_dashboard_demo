# Tactical Dashboard

Revenue dashboard replicating the MTD/projected/category breakdown layout, backed by BigQuery's `sales_accrual` table.

## Project Structure

```
tactical-dashboard/
├── backend/          ← FastAPI (Python)
│   ├── main.py
│   ├── requirements.txt
│   ├── Procfile
│   └── railway.json
├── frontend/         ← React
│   ├── src/
│   │   ├── App.js / App.css
│   │   ├── components/
│   │   │   ├── KpiCard.jsx
│   │   │   ├── RevenueChart.jsx
│   │   │   ├── CategoryChart.jsx
│   │   │   └── WeeklyTable.jsx
│   │   ├── hooks/useDashboard.js
│   │   └── utils/api.js, format.js
│   ├── public/index.html
│   └── railway.json
└── .gitignore
```

## Local Development

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your values
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env   # set REACT_APP_API_URL=http://localhost:8000
npm start
```

## Railway Deployment

Deploy backend and frontend as **two separate Railway services** from the same GitHub repo.

### 1. Backend Service
- **Root directory**: `backend`
- **Environment variables** (set in Railway dashboard):
  | Variable | Value |
  |---|---|
  | `BIGQUERY_PROJECT_ID` | your GCP project ID |
  | `BIGQUERY_DATASET` | your dataset name |
  | `BIGQUERY_TABLE` | `sales_accrual` |
  | `BIGQUERY_SERVICE_ACCOUNT_JSON` | paste full JSON content of your service account key |
  | `MONTHLY_GOAL` | e.g. `10000000` |

### 2. Frontend Service
- **Root directory**: `frontend`
- **Environment variables**:
  | Variable | Value |
  |---|---|
  | `REACT_APP_API_URL` | your backend Railway URL (e.g. `https://backend-xxx.railway.app`) |

> ⚠️ Never commit `bigquery_service_account.json` or `.env` files. Use Railway's env variable UI to set `BIGQUERY_SERVICE_ACCOUNT_JSON`.

## BigQuery Credentials (Railway)

1. In GCP → IAM → Service Accounts, create a service account with **BigQuery Data Viewer** + **BigQuery Job User** roles.
2. Download the JSON key.
3. In Railway → your backend service → Variables, create `BIGQUERY_SERVICE_ACCOUNT_JSON` and paste the entire JSON content as the value.

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `BIGQUERY_PROJECT_ID` | ✅ | GCP project ID |
| `BIGQUERY_DATASET` | ✅ | BigQuery dataset name |
| `BIGQUERY_TABLE` | ✅ | Table name (default: `sales_accrual`) |
| `BIGQUERY_SERVICE_ACCOUNT_JSON` | ✅ (Railway) | Full service account JSON string |
| `BIGQUERY_SERVICE_ACCOUNT_PATH` | local only | Path to JSON file |
| `MONTHLY_GOAL` | optional | Revenue goal for the goal line |
| `REACT_APP_API_URL` | ✅ frontend | Backend URL |

# Evolve Med Spa — Tactical Dashboard

A full-stack tactical dashboard for revenue, leaderboard, appointment, utilization, and marketing analytics, powered by BigQuery and optionally enriched with AI-generated insights (OpenAI / Gemini).

---

## Project Structure

```
evolve_spa_dashboard/
├── backend/
│   ├── main.py                    # FastAPI entry point — wires all routers
│   ├── requirements.txt
│   ├── Procfile                   # Deployment: uvicorn main:app
│   ├── railway.json
│   ├── .env                       # Local env vars (not committed)
│   ├── bigquery_service_account.json   # Local only (not committed)
│   ├── core/
│   │   └── config.py              # BQ client, table refs, date helpers, run_query_async
│   ├── routers/
│   │   ├── centers.py             # GET /api/centers + /api/appointment_centers
│   │   ├── revenue.py             # POST /api/revenue  (+ /api/dashboard legacy alias)
│   │   ├── leaderboard.py         # POST /api/leaderboard
│   │   ├── appointments.py        # POST /api/appointments
│   │   ├── utilization.py         # POST /api/utilization
│   │   ├── marketing.py           # POST /api/marketing
│   │   └── insights.py            # POST /api/insights  (AI: OpenAI → Gemini fallback)
│   └── utils/
│       └── errors.py              # Centralised error_response() helper
│
└── frontend/
    ├── public/
    │   └── index.html
    └── src/
        ├── App.js                 # Root: tabs, filters, center lists, AI data relay
        ├── App.css                # All styles (design tokens, layout, components)
        ├── index.js
        ├── index.css
        ├── components/
        │   ├── Revenue.jsx        # Revenue KPIs, charts, ASP, cash sales
        │   ├── Leaderboard.jsx    # Staff ranking, servicer table, referrals
        │   ├── Appointments.jsx   # Appointment KPIs, status, category, provider charts
        │   ├── Utilization.jsx    # Provider util %, revenue/hr, role summary
        │   ├── Marketing.jsx      # Marketing funnel, spend line chart, source pie chart, KPIs
        │   └── AiInsights.jsx     # AI panel — auto-generates on tab/filter change
        ├── hooks/
        │   └── useDashboard.js    # Optional hook for revenue data (legacy-compatible)
        └── utils/
            ├── api.js             # Typed fetch helpers for all endpoints
            └── format.js          # Currency, number, date, % formatters
```

---

## Features

| Tab | Metrics |
|---|---|
| **Revenue** | MTD revenue, projected, rev/day, rev/hr, 30-day ADV, **ASP** (revenue ÷ invoices), **cash sales**, goal progress bar, daily chart, sales mix donut, weekly WoW table |
| **Leaderboard** | Staff ranking with **ASP per staff**, servicer table with **ASP column**, referral source bars |
| **Appointments** | Total, closed, no-show rate, cancel rate, **rebook rate (rebooked ÷ closed)**, first-visit rate, utilisation %, add-ons, category/provider/booking source/hourly charts |
| **Utilization** | Provider util % (booked ÷ scheduled), **revenue/utilized hour** (sales ÷ booked hrs joined on serviced_by + date + center), role summary table |
| **Marketing** | Marketing funnel (ad spend → clicks → new clients → revenue), spend-by-date line chart (per source), spend-by-source pie chart, CAC, ROAS, returning clients, rev per new client, source table, funnel performance table. Ad spend is divided by 4 for display. |
| **AI Insights** | Auto-generates on every tab/filter change after the first load; manual ↻ Regenerate button; OpenAI primary, Gemini fallback |

### Key metric corrections vs. original code

| Metric | Correction |
|---|---|
| ASP | `SUM(sales_exc_tax) / COUNT(DISTINCT invoice_no)` — was dividing by row count |
| Cash sales | `SUM(collected) WHERE payment_type = 'Cash' AND status = 'Closed'` — was missing |
| Sales mix | Groups by `item_category` for % (was sub-category only) |
| Rebook rate | `COUNT(rebooked=TRUE) / COUNT(status='Closed')` — was dividing by total |
| Utilization join | `serviced_by = employee_name AND date AND center_name` — was missing date + center |
| `start_time` in BigQuery | `EXTRACT(HOUR FROM start_time)` — column is `TIME`, not `TIMESTAMP` |

---

## Local Development

### Backend

```bash
cd backend
python -m venv .venv

# Windows
.\.venv\Scripts\Activate.ps1

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

Create `backend/.env` (see Environment Variables below), then:

```bash
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm start
```

Set `REACT_APP_API_URL=http://localhost:8000` in `frontend/.env` or `frontend/.env.local`.

---

## Backend Environment Variables

| Variable | Required | Description |
|---|---|---|
| `BIGQUERY_PROJECT_ID` | ✅ | GCP project ID |
| `BIGQUERY_DATASET` | ✅ | BigQuery dataset name |
| `BIGQUERY_TABLE` | ✅ | Sales accrual table (default: `sales_accrual`) |
| `BIGQUERY_APPT_TABLE` | ✅ | Appointments table |
| `BIGQUERY_SCHEDULE_TABLE` | ✅ | Employee schedule table (default: `employee_schedule`) |
| `BIGQUERY_MARKETING_TABLE` | ✅ | Marketing/ad spend table |
| `GOOGLE_APPLICATION_CREDENTIALS` | ✅ local | Path to service account JSON |
| `BIGQUERY_CREDENTIALS_BASE64` | ✅ deploy | Base64-encoded service account JSON |
| `MONTHLY_GOAL` | optional | Numeric revenue goal (e.g. `150000`) |
| `OPENAI_API_KEY` | optional | Primary AI provider for insights |
| `GEMINI_API_KEY` | optional | Fallback AI provider for insights |
| `PORT` | optional | Backend port (default `8000`) |

> ⚠️ Never commit `.env`, `bigquery_service_account.json`, or any key files.

---

## API Reference

### Health
```
GET /health
→ { status, timestamp }
```

### Centers
```
GET /api/centers               → { centers: [string] }
GET /api/appointment_centers   → { centers: [string] }
```

### Revenue — `POST /api/revenue`
Body: `{ action, month, center }`

| action | Returns |
|---|---|
| `summary` | `{ mtd_revenue, projected, rev_per_day, rev_per_hour, adv, yesterday_revenue, asp, invoice_count, cash_sales, goal, days_elapsed, days_in_month }` |
| `daily` | `{ data: [{date, daily_revenue, mtd_cumulative, goal_mtd}], goal }` |
| `categories` | `{ total, categories: [{category, revenue, percentage, invoice_count}], breakdown }` |
| `weekly` | `{ weeks: [{week, revenue, wow}], full_month_pace }` |
| `asp` | `{ data: [{month, revenue, invoices, asp}] }` |
| `cash_sales` | `{ total_cash, data: [{date, cash_collected, cash_invoices}] }` |

`POST /api/dashboard` — legacy alias for `/api/revenue`.

### Leaderboard — `POST /api/leaderboard`
Body: `{ action, month, center }`

| action | Returns |
|---|---|
| `staff` | `{ data: [{rank, staff, revenue, share, invoice_count, units_sold, asp}], total }` |
| `service_types` | `{ data: [{servicer, revenue, invoices, asp, share}], total }` |
| `referrals` | `{ data: [{source, count, revenue, share}], total }` |
| `staff_trend` | `{ data: [{staff, trend: [{date, revenue}]}] }` |

### Appointments — `POST /api/appointments`
Body: `{ action, month, center }`

| action | Returns |
|---|---|
| `summary` | Full KPIs incl. `rebook_rate` (rebooked ÷ closed), `first_visit_rate`, `addons`, `utilisation_pct` |
| `rebook_rate` | Same data as summary — avoids a second query |
| `daily` | `{ data: [{date, count, cumulative}] }` |
| `by_status` | `{ data: [{status, count, pct}] }` |
| `by_category` | `{ data: [{category, count, pct}] }` (Closed only) |
| `by_provider` | `{ data: [{provider, count, closed_count, rebooked_count, rebook_rate, pct}] }` |
| `by_booking_source` | `{ data: [{source, count, pct}] }` |
| `by_hour` | `{ data: [{hour, count}] }` (Closed only) |
| `weekly` | `{ weeks: [{week, total, closed, noshows, cancelled, wow}] }` |

### Utilization — `POST /api/utilization`
Body: `{ action, month, center }`

| action | Returns |
|---|---|
| `provider_utilization` | `{ data: [{employee, role, center, scheduled_hours, booked_hours, utilization_pct}] }` |
| `revenue_per_hour` | `{ data: [{employee, role, center, booked_hours, scheduled_hours, revenue, rev_per_hour, utilization_pct}] }` — joined on `serviced_by + date + center_name` |
| `role_summary` | `{ data: [{role, headcount, scheduled_hours, booked_hours, revenue, utilization_pct, rev_per_hour}] }` |
| `daily_utilization` | `{ data: [{date, center, scheduled_hours, booked_hours, utilization_pct}] }` |

### Marketing — `POST /api/marketing`
Body: `{ action, month, center }`

| action | Returns |
|---|---|
| `funnel` | `{ ad_spend, clicks, new_clients, returning_clients, new_client_revenue, cac, rev_per_new_client, roas, click_rate, new_client_rate, revenue_vs_spend }` |
| `by_source` | `{ data: [{source, ad_spend, pct_total_spend}] }` |
| `daily_by_source` | `{ data: [{date, source, ad_spend}] }` |

> **Note:** The marketing table has no center column. Ad spend and clicks are account-wide; the center filter applies only to clients and revenue stages.

### AI Insights — `POST /api/insights`
Body: `{ tab, prompt, month, center }`  
Returns: `{ insight: string, provider: "openai" | "gemini" }`

The frontend (`AiInsights.jsx`) builds the full grounded prompt from dashboard data and sends it here. The backend calls OpenAI first, falls back to Gemini if OpenAI is unavailable or fails.

---

## AI Insights — Data Flow

```
Panel (e.g. Revenue.jsx)
  └─ onData({ summary, daily, categories, weekly }, false)
       └─ App.js panelData state
            └─ AiInsights({ tab, data: panelData, loading, month, center })
                 └─ buildRevenuePrompt(data, month, center)
                      └─ POST /api/insights → OpenAI / Gemini
```

**Key data keys per tab** (must match `onData` shape in each component):

| Tab | onData keys |
|---|---|
| Revenue | `summary`, `daily`, `categories` (full obj), `weekly` |
| Leaderboard | `staff`, `serviceTypes`, `referrals` |
| Appointments | `summary`, `byStatus`, `byCategory`, `byProvider`, `byBookingSource` |
| Utilization | `providers`, `revPerHour`, `roleSummary` |
| Marketing | `funnel`, `sources` |

---

## Deployment

### Backend (Railway / Render / Fly.io)
- Set all env vars in the platform dashboard
- Use `BIGQUERY_CREDENTIALS_BASE64` instead of a file path
- `Procfile`: `web: uvicorn main:app --host 0.0.0.0 --port $PORT`

### Frontend
- Set `REACT_APP_API_URL` to your deployed backend URL
- Build: `npm run build`
- Serve the `build/` folder from any static host (Vercel, Netlify, Railway static)

---

## Quick Start

```bash
# 1. Configure backend env vars
cp backend/.env.example backend/.env
# edit backend/.env with your credentials

# 2. Start backend
cd backend && uvicorn main:app --reload --port 8000

# 3. Start frontend
cd frontend
echo "REACT_APP_API_URL=http://localhost:8000" > .env.local
npm install && npm start
```

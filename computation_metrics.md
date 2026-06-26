# Computation Metrics Knowledgebase

Complete reference for every metric computed across the Evolve Med Spa Tactical Dashboard backend. All queries run against BigQuery via `run_query_async`.

---

## Data Sources (BigQuery Tables)

| Alias | Env Var | Description |
|---|---|---|
| `sales_tbl` | `BIGQUERY_TABLE` | Sales accrual records (invoices, revenue, payments) |
| `appt_tbl` | `BIGQUERY_APPT_TABLE` | Appointment records (status, providers, first_visit, rebooked) |
| `sched_tbl` | `BIGQUERY_SCHEDULE_TABLE` | Employee schedule (scheduled_hours, booked_hours per day) |
| `mkt_tbl` | `BIGQUERY_MARKETING_TABLE` | Marketing/ad spend data (spend, clicks, source per day) |

**Revenue column:** `sales_exc_tax` (aliased as `REV` in all routers)

---

## Common Filters

| Filter | SQL | Notes |
|---|---|---|
| MTD (month-to-date) | `DATE BETWEEN '{start_str}' AND '{today}'` | `today = min(today, last_day_of_month)` |
| Full month | `DATE BETWEEN '{start_str}' AND '{end_str}'` | Used by daily chart only |
| Closed sales | `status = 'Closed'` | All revenue metrics require Closed status |
| Center filter | `AND center_name = '{center}'` | Omitted when center = "All" |
| Non-deleted appts | `status != 'Deleted'` | All appointment queries exclude Deleted |

---

## 1. Revenue (`/api/revenue`)

### Summary

| Metric | Formula | SQL |
|---|---|---|
| **MTD Revenue** | Sum of sales_exc_tax for closed sales MTD | `SUM(sales_exc_tax) WHERE status='Closed' AND date BETWEEN start AND today` |
| **Yesterday Revenue** | Sales on yesterday's date | `SUM(CASE WHEN DATE(invoice_closed_date) = '{yesterday}' THEN sales_exc_tax END)` |
| **Projected** | `rev_per_day × days_in_month` | Computed in Python |
| **Rev / Day** | `mtd_revenue / days_elapsed` | Computed in Python |
| **Rev / Hour** | `rev_per_day / 10` | Assumes 10 operating hours per day |
| **30-Day ADV** | Average daily value over last 30 calendar days | `AVG(daily) FROM (SELECT SUM(sales_exc_tax) AS daily ... GROUP BY date) WHERE date BETWEEN today-30 AND today` |
| **ASP** | Revenue per unique invoice | `SUM(sales_exc_tax) / COUNT(DISTINCT invoice_no)` — uses `SAFE_DIVIDE` |
| **Invoice Count** | Distinct invoices MTD | `COUNT(DISTINCT invoice_no)` |
| **Cash Sales** | Cash-collected amount | `SUM(collected) WHERE UPPER(TRIM(payment_type)) = 'CASH' AND status = 'Closed'` |
| **Goal** | Monthly target | `MONTHLY_GOAL` env var (static) |

### Daily

| Metric | Formula |
|---|---|
| **Daily Revenue** | `SUM(sales_exc_tax)` grouped by `DATE(invoice_closed_date)` |
| **MTD Cumulative** | Running sum in Python: `cumulative += daily_revenue` |
| **Goal MTD** | `goal_per_day × (day_index + 1)` where `goal_per_day = MONTHLY_GOAL / days_in_month` |

### Categories (Sales Mix)

| Metric | Formula |
|---|---|
| **Category Revenue** | `SUM(sales_exc_tax)` grouped by `item_category` |
| **Category %** | `category_revenue / total × 100` |
| **Category Invoice Count** | `COUNT(DISTINCT invoice_no)` per category |
| **Breakdown** | Sub-level: grouped by `(item_category, item_sub_category)` |

### ASP (Standalone)

| Metric | Formula |
|---|---|
| **ASP per month** | `SAFE_DIVIDE(SUM(sales_exc_tax), COUNT(DISTINCT invoice_no))` grouped by month |

### Cash Sales (Standalone)

| Metric | Formula |
|---|---|
| **Daily Cash** | `SUM(collected) WHERE payment_type = 'CASH'` grouped by day |
| **Total Cash** | Sum of all daily cash in Python |

### Weekly

| Metric | Formula |
|---|---|
| **Week Revenue** | Sum of daily revenue for days within each 7-day window |
| **WoW %** | `(current_week - prev_week) / prev_week × 100` — `None` for Week 1 |
| **Full Month Pace** | Sum of all weeks' revenue |

**Note:** Week count = `ceil(days_in_month / 7)`. Final week clips to real month end.

---

## 2. Leaderboard (`/api/leaderboard`)

### Staff

| Metric | Formula | SQL |
|---|---|---|
| **Revenue** | Per-staff sales | `SUM(sales_exc_tax)` grouped by `sold_by` |
| **Share %** | `staff_revenue / total_revenue × 100` | Computed in Python |
| **Invoice Count** | Distinct invoices per staff | `COUNT(DISTINCT invoice_no)` |
| **Units Sold** | Quantity sold | `SUM(qty)` |
| **ASP** | Per-staff selling price | `SAFE_DIVIDE(SUM(sales_exc_tax), COUNT(DISTINCT invoice_no))` |
| **Rank** | Ordered by revenue descending | Enumerated in Python (1-indexed) |

**Limit:** Top 20 staff

### Service Types (by Servicer)

| Metric | Formula |
|---|---|
| **Revenue** | `SUM(sales_exc_tax)` grouped by `serviced_by` |
| **Invoices** | `COUNT(DISTINCT invoice_no)` |
| **ASP** | `SAFE_DIVIDE(SUM(sales_exc_tax), COUNT(DISTINCT invoice_no))` |
| **Share %** | `servicer_revenue / total × 100` |

**Limit:** Top 15 servicers

### Referrals

| Metric | Formula |
|---|---|
| **Count** | `COUNT(DISTINCT invoice_no)` per `referral_source` |
| **Revenue** | `SUM(sales_exc_tax)` per source |
| **Share %** | `source_count / total_count × 100` |

**Limit:** Top 10 sources

### Staff Trend

Daily revenue for top-N staff: `SUM(sales_exc_tax)` grouped by `(sold_by, DATE(invoice_closed_date))`.

---

## 3. Appointments (`/api/appointments`)

### Summary

| Metric | Formula | SQL / Notes |
|---|---|---|
| **Total Appointments** | All non-deleted appts MTD | `COUNT(*)` |
| **Closed** | Status = Closed | `COUNTIF(status = 'Closed')` |
| **No-Shows** | Status = Closed (No Show) | `COUNTIF(status = 'Closed (No Show)')` |
| **Cancelled** | Status = Cancelled | `COUNTIF(status = 'Cancelled')` |
| **Rebooked** | Rebooked flag TRUE | `COUNTIF(rebooked = TRUE)` |
| **First Visits** | First visit flag TRUE | `COUNTIF(first_visit = TRUE)` |
| **Surprise Visits** | Surprise visit flag TRUE | `COUNTIF(surprise_visit = TRUE)` |
| **Add-ons** | Add-on = 'YES' | `COUNTIF(UPPER(TRIM(COALESCE(add_on, ''))) = 'YES')` |
| **Avg Per Day** | `total / days_elapsed` | Python |
| **No-Show Rate** | `noshows / total × 100` | Python |
| **Cancel Rate** | `cancelled / total × 100` | Python |
| **Rebook Rate** | `rebooked / closed × 100` | **Denominator is closed, NOT total** |
| **First Visit Rate** | `first_visits / closed × 100` | **Denominator is closed, NOT total** |
| **Utilisation %** | `total_scheduled_min / capacity_min × 100` | `capacity_min = days_elapsed × 10 × 60` (10hrs/day) |
| **Avg Actual Duration** | Mean of `actual_duration` (non-null only) | `AVG(CASE WHEN actual_duration IS NOT NULL THEN actual_duration END)` |

### By Status

| Metric | Formula |
|---|---|
| **Count** | `COUNT(*)` per status |
| **Pct** | `count / total × 100` |

### By Category (Closed Only)

| Metric | Formula |
|---|---|
| **Count** | `COUNT(*)` per `service_category` WHERE `status = 'Closed'` |
| **Pct** | `count / total_closed × 100` |

### By Provider

| Metric | Formula |
|---|---|
| **Count** | `COUNT(*)` per `providers` |
| **Closed Count** | `COUNTIF(status = 'Closed')` |
| **Rebooked Count** | `COUNTIF(rebooked = TRUE)` |
| **Rebook Rate** | `rebooked_count / closed_count × 100` (0 if no closed) |
| **Pct** | `count / total × 100` |

### By Booking Source

`COUNT(*)` per `booking_source`, with pct of total. Limit 12.

### By Hour (Closed Only)

`COUNT(*)` per `EXTRACT(HOUR FROM start_time)` WHERE `status = 'Closed'`.

**Note:** `start_time` is a `TIME` column, not `TIMESTAMP`.

### Weekly

Day-level query aggregated in Python into 7-day windows. WoW = `(current - prev) / prev × 100`.

---

## 4. Utilization (`/api/utilization`)

### Provider Utilization

| Metric | Formula | SQL |
|---|---|---|
| **Scheduled Hours** | Total scheduled per employee | `SUM(s.scheduled_hours)` |
| **Booked Hours** | Total booked per employee | `SUM(s.booked_hours)` |
| **Utilization %** | `booked / scheduled × 100` | `SAFE_DIVIDE(SUM(booked_hours), SUM(scheduled_hours))` — displayed as % |

**Source:** `employee_schedule` table only. Filter: `scheduled_hours > 0`. Limit 30.

### Revenue per Utilized Hour

| Metric | Formula | SQL |
|---|---|---|
| **Revenue** | Sales tied to provider | `SUM(sa.sales_exc_tax)` |
| **Rev / Hour** | `revenue / booked_hours` | `SAFE_DIVIDE(SUM(sales_exc_tax), SUM(booked_hours))` |
| **Utilization %** | Same as above | `SAFE_DIVIDE(booked, scheduled)` |

**JOIN keys:** `employee_schedule` LEFT JOIN `sales_accrual` ON:
- `LOWER(TRIM(serviced_by)) = LOWER(TRIM(employee_name))`
- `DATE(invoice_closed_date) = date`
- `LOWER(TRIM(sa.center_name)) = LOWER(TRIM(s.center_name))`
- `sa.status = 'Closed'`

### Role Summary

Same join as Revenue per Hour, but grouped by `job_name` instead of individual employee.

| Metric | Formula |
|---|---|
| **Headcount** | `COUNT(DISTINCT employee_name)` |
| **Scheduled/Booked Hours** | SUM per role |
| **Revenue** | `SUM(sales_exc_tax)` via join |
| **Utilization %** | `booked / scheduled × 100` |
| **Rev / Hour** | `revenue / booked_hours` |

### Daily Utilization

`SUM(booked_hours) / SUM(scheduled_hours)` grouped by `(date, center_name)`.

---

## 5. Marketing (`/api/marketing`)

### Funnel

Three concurrent queries joined in Python:

**Query 1 — Spend/Clicks** (marketing table, no center filter):

| Metric | SQL |
|---|---|
| **Ad Spend** | `SUM(spend)` from marketing table |
| **Clicks** | `SUM(clicks)` from marketing table |

**Query 2 — Clients** (appointments table, center filter applies):

| Metric | SQL |
|---|---|
| **New Clients** | `COUNTIF(first_visit = TRUE)` |
| **Returning Clients** | `COUNTIF(first_visit = FALSE)` |

**Query 3 — New-Client Revenue** (sales table with EXISTS subquery):

| Metric | SQL |
|---|---|
| **New Client Revenue** | `SUM(sales_exc_tax)` WHERE `status = 'Closed'` AND `EXISTS (matching first_visit appointment)` |

**EXISTS join keys:**
- `LOWER(TRIM(ap.providers)) = LOWER(TRIM(sa.serviced_by))`
- `ap.appointment_date = DATE(sa.invoice_closed_date)`
- `LOWER(TRIM(ap.center_name)) = LOWER(TRIM(sa.center_name))`
- `ap.first_visit = TRUE`
- `ap.status != 'Deleted'`

**Derived KPIs (computed in backend Python, recalculated in frontend after ÷4):**

| Metric | Formula | Notes |
|---|---|---|
| **CAC** | `ad_spend / new_clients` | Cost of Acquisition |
| **Rev per New Client** | `new_client_revenue / new_clients` | Not affected by ÷4 |
| **ROAS** | `new_client_revenue / ad_spend` | 4× higher after ÷4 (correct for divided spend) |
| **Click Rate** | `clicks / ad_spend` | 4× higher after ÷4 (correct for divided spend) |
| **New Client Rate** | `new_clients / clicks` | Not affected by ÷4 |
| **Revenue vs Spend** | `new_client_revenue / ad_spend` | Same as ROAS |

**Frontend modification:** All `ad_spend` values are divided by 4 before display. Derived KPIs (CAC, ROAS, click_rate, revenue_vs_spend) are recalculated in the frontend after the division.

### Funnel Performance Table (frontend-only)

The FunnelTable computes display values locally from the funnel object:

| Stage | Count / Amount | Conversion Rate | % of Ad Spend |
|---|---|---|---|
| Ad Spend | `amt(ad_spend)` | – | 100.00% |
| Clicks | `int(clicks)` | `clicks / ad_spend` per $ | – |
| New Clients | `int(new_clients)` | `new_clients / clicks` as % | `new_clients / ad_spend` as % |
| Revenue from New Clients | `amt(new_client_revenue)` | `revenue / new_clients` per client | `revenue / ad_spend` as % |

### By Source

| Metric | SQL |
|---|---|
| **Ad Spend per Source** | `SUM(spend)` grouped by `source` |
| **% of Total** | `SAFE_DIVIDE(SUM(spend), SUM(SUM(spend)) OVER())` — window function |

### Daily by Source

`SUM(spend)` grouped by `(DATE(date), source)`. Used for line chart visualization.

---

## 6. AI Insights (`/api/insights`)

No metric computation. Receives a prompt from frontend and relays to:
1. **OpenAI** (gpt-4o-mini) — primary
2. **Gemini** (gemini-flash-latest) — fallback

Temperature: 0.2, max tokens: 600, timeout: 30s.

**Env vars:** `OPENAI_API_KEY` (optional), `GEMINI_API_KEY` (optional). At least one required.

**Removed env vars:** `APP_ENV` (was assigned but never used), `AI_INSIGHTS_DEBUG` (debug logging removed).

---

## Key Implementation Notes

### Date Handling
- `month_context(month_str)` returns: `start_str`, `end_str`, `today` (capped at month end), `days_elapsed`, `days_in_month`
- `today = min(actual_today, last_day_of_month)` — prevents future dates for past months

### Center Filter Behavior
- Revenue, Leaderboard, Appointments, Utilization: center filter applies to all queries
- Marketing: center filter applies to clients & revenue only, **NOT** to spend/clicks (marketing table has no center column)

### Join Strategy
- **Utilization ↔ Sales:** LEFT JOIN on `(serviced_by = employee_name, date, center_name)` — case-insensitive, trimmed
- **Marketing Revenue:** EXISTS subquery (not JOIN) to avoid double-counting when multiple first-visit appointments match

### Performance
- All queries use `run_query_async` (thread pool executor, non-blocking)
- Summary endpoints use `asyncio.gather()` for concurrent query execution
- Revenue summary: 2 concurrent queries (was 5 sequential)
- Marketing funnel: 3 concurrent queries

### Division Safety
- BigQuery: `SAFE_DIVIDE()` returns NULL on divide-by-zero
- Python: explicit `if denominator else 0` guards

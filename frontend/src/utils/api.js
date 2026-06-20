/**
 * utils/api.js
 * ─────────────────────────────────────────────────────────────
 * Thin fetch wrappers used by components and the useDashboard hook.
 *
 * All functions return the parsed JSON response body.
 * Throws on non-2xx HTTP status so callers can catch errors uniformly.
 */

const API_BASE = (process.env.REACT_APP_API_URL || "http://localhost:8000").replace(/\/$/, "");

/**
 * Generic POST helper.
 * @param {string} path   - e.g. "/api/revenue"
 * @param {object} body   - JSON-serialisable request body
 * @returns {Promise<any>}
 */
export async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${path}`);
  return res.json();
}

// ── Revenue ───────────────────────────────────────────────────────────────────

/**
 * Fetch revenue summary (MTD, projected, ASP, cash sales, goal…).
 * Returns the full summary object including new fields: asp, invoice_count, cash_sales.
 */
export function fetchSummary(month, center = "All") {
  return apiPost("/api/revenue", { action: "summary", month, center });
}

export function fetchDailyRevenue(month, center = "All") {
  return apiPost("/api/revenue", { action: "daily", month, center });
}

/**
 * Fetch sales mix by item category.
 * Returns { total, categories: [{category, revenue, percentage, invoice_count}], breakdown }.
 * NOTE: previous code expected { data: [...] } — new shape is { categories: [...] }.
 */
export function fetchCategoryRevenue(month, center = "All") {
  return apiPost("/api/revenue", { action: "categories", month, center });
}

export function fetchWeeklyRevenue(month, center = "All") {
  return apiPost("/api/revenue", { action: "weekly", month, center });
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export function fetchStaffLeaderboard(month, center = "All") {
  return apiPost("/api/leaderboard", { action: "staff", month, center });
}

export function fetchServiceTypes(month, center = "All") {
  return apiPost("/api/leaderboard", { action: "service_types", month, center });
}

export function fetchReferrals(month, center = "All") {
  return apiPost("/api/leaderboard", { action: "referrals", month, center });
}

// ── Appointments ──────────────────────────────────────────────────────────────

export function fetchAppointmentSummary(month, center = "All") {
  return apiPost("/api/appointments", { action: "summary", month, center });
}

export function fetchAppointmentsByStatus(month, center = "All") {
  return apiPost("/api/appointments", { action: "by_status", month, center });
}

export function fetchAppointmentsByProvider(month, center = "All") {
  return apiPost("/api/appointments", { action: "by_provider", month, center });
}

// ── Utilization ───────────────────────────────────────────────────────────────

export function fetchProviderUtilization(month, center = "All") {
  return apiPost("/api/utilization", { action: "provider_utilization", month, center });
}

export function fetchRevenuePerHour(month, center = "All") {
  return apiPost("/api/utilization", { action: "revenue_per_hour", month, center });
}

export function fetchRoleSummary(month, center = "All") {
  return apiPost("/api/utilization", { action: "role_summary", month, center });
}

// ── Centers ───────────────────────────────────────────────────────────────────

export async function fetchSalesCenters() {
  const res = await fetch(`${API_BASE}/api/centers`);
  if (!res.ok) throw new Error("Failed to fetch sales centers");
  return res.json();
}

export async function fetchAppointmentCenters() {
  const res = await fetch(`${API_BASE}/api/appointment_centers`);
  if (!res.ok) throw new Error("Failed to fetch appointment centers");
  return res.json();
}


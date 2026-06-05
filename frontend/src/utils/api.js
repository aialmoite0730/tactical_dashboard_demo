const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

async function post(action, month) {
  const res = await fetch(`${BASE_URL}/api/dashboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, month }),
  });
  if (!res.ok) throw new Error(`Failed to fetch ${action}`);
  return res.json();
}

export const fetchSummary       = (month) => post("summary",    month);
export const fetchDailyRevenue  = (month) => post("daily",      month);
export const fetchCategoryRevenue = (month) => post("categories", month);
export const fetchWeeklyRevenue = (month) => post("weekly",     month);

/**
 * useDashboard — legacy hook kept for backwards compatibility.
 *
 * NOTE: The active dashboard panels (Revenue, Leaderboard, Appointments,
 * Utilization) each manage their own data fetching via direct fetch() calls
 * inside the component. This hook is no longer wired into any panel but is
 * preserved here in case it is used by other parts of the codebase.
 *
 * If you are adding a new panel, follow the pattern in Revenue.jsx:
 *   - Accept { apiBase, month, center } as props
 *   - Use useCallback + useEffect with your own loading/error/loaded state
 *   - POST to the relevant /api/<resource> endpoint with { action, month, center }
 */

import { useState, useEffect, useCallback } from "react";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

function currentMonth() {
  const now = new Date();
  const m   = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${m}`;
}

async function post(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Fetches the Revenue summary, daily, categories, and weekly data
 * for a given { month, center }.
 *
 * Mirrors the API shape consumed by Revenue.jsx:
 *   summary  → { mtd_revenue, yesterday_revenue, projected, rev_per_day,
 *                rev_per_hour, adv, asp, invoice_count, cash_sales, goal }
 *   daily    → { data: [{ date, daily_revenue, mtd_cumulative, goal_mtd }] }
 *   catsData → { categories: [...], breakdown: [...], total }
 *   weekly   → { weeks: [{ week, revenue, wow }], full_month_pace }
 */
export function useDashboard({ month: monthProp, center = "All" } = {}) {
  const [month,    setMonth]    = useState(monthProp || currentMonth());
  const [summary,  setSummary]  = useState(null);
  const [daily,    setDaily]    = useState([]);
  const [catsData, setCatsData] = useState(null);   // { categories, breakdown, total }
  const [weekly,   setWeekly]   = useState({ weeks: [], full_month_pace: 0 });
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const mkBody = (action) => ({ action, month, center });
      const [s, d, c, w] = await Promise.all([
        post("/api/revenue", mkBody("summary")),
        post("/api/revenue", mkBody("daily")),
        post("/api/revenue", mkBody("categories")),
        post("/api/revenue", mkBody("weekly")),
      ]);
      if (s.error) throw new Error(s.error);
      setSummary(s);
      setDaily(d.data   || []);
      setCatsData(c);                                // full object, not just .data
      setWeekly(w);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [month, center]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, [load]);

  return {
    month, setMonth,
    summary,
    daily,
    // Expose both the full object and the flat array for flexibility
    catsData,
    categories: catsData?.categories || [],
    weekly,
    loading,
    error,
    refresh: load,
  };
}
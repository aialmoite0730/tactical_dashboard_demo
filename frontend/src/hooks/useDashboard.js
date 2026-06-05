import { useState, useEffect, useCallback } from "react";
import {
  fetchSummary,
  fetchDailyRevenue,
  fetchCategoryRevenue,
  fetchWeeklyRevenue,
} from "../utils/api";
import { currentMonth } from "../utils/format";

export function useDashboard() {
  const [month, setMonth] = useState(currentMonth());
  const [summary, setSummary] = useState(null);
  const [daily, setDaily] = useState([]);
  const [categories, setCategories] = useState([]);
  const [weekly, setWeekly] = useState({ weeks: [], full_month_pace: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, d, c, w] = await Promise.all([
        fetchSummary(month),
        fetchDailyRevenue(month),
        fetchCategoryRevenue(month),
        fetchWeeklyRevenue(month),
      ]);
      setSummary(s);
      setDaily(d.data || []);
      setCategories(c.data || []);
      setWeekly(w);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, [load]);

  return { month, setMonth, summary, daily, categories, weekly, loading, error, refresh: load };
}

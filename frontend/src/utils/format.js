/**
 * utils/format.js
 * ─────────────────────────────────────────────────────────────
 * Shared formatting helpers used across components and the useDashboard hook.
 */

/**
 * Returns the current month as "YYYY-MM".
 */
export function currentMonth() {
  const now = new Date();
  const m   = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${m}`;
}

/**
 * Format a number as USD currency.
 * @param {number|null} n
 * @param {boolean} compact  - if true, abbreviates to $Xk / $X.XXM
 */
export function fmt(n, compact = false) {
  if (n === null || n === undefined) return "$—";
  if (compact && n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (compact && n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Format a number with locale commas.
 * @param {number|null} n
 * @param {number} dec  - decimal places (default 0)
 */
export function fmtNum(n, dec = 0) {
  return (n ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

/**
 * Format a percentage with optional sign prefix.
 * @param {number|null} v
 */
export function fmtPct(v) {
  if (v === null || v === undefined) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

/**
 * Format a date string "YYYY-MM-DD" as "Jan 5".
 */
export function fmtDate(s) {
  if (!s) return "";
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Format a Y-axis tick as "$XXK".
 */
export function fmtAxisY(v)  { return `$${(v / 1000).toFixed(0)}K`; }

/**
 * Format a Y-axis tick as "$X.XM".
 */
export function fmtAxisY2(v) { return `$${(v / 1_000_000).toFixed(1)}M`; }
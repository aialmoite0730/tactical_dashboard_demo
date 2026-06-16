import React, { useState, useEffect, useRef, useCallback } from "react";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

// ── Formatters ────────────────────────────────────────────────────────────────
function currency(n) {
  if (n == null || isNaN(Number(n))) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(Number(n));
}
function pct(n, d = 1) {
  if (n == null || isNaN(Number(n))) return "N/A";
  return Number(n).toFixed(d) + "%";
}
function num(n) {
  if (n == null || isNaN(Number(n))) return "N/A";
  return new Intl.NumberFormat("en-US").format(Math.round(Number(n)));
}
function signedPct(n) {
  if (n == null || isNaN(Number(n))) return "N/A";
  const v = Number(n);
  return (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
}
// "0" is a real reported value — never collapse it to "MISSING".
function valOrMissing(n, formatter) {
  if (n == null || isNaN(Number(n))) return "MISSING";
  return formatter(n);
}

// ── Grounding rules injected into every prompt ─────────────────────────────────
const GROUNDING_RULES =
  `RULES:\n` +
  `- Use ONLY the numbers provided. Do not invent, estimate, or assume any figure.\n` +
  `- "MISSING" or "N/A" means the data point is unavailable — say so or skip it.\n` +
  `- "0" or "0%" is a real result, not missing data.\n` +
  `- Do not speculate about causes not stated in the data.\n` +
  `- When citing an outlier, name it and quote the exact number.\n` +
  `- Every recommendation must reference a specific metric cited earlier.\n` +
  `- Plain business English. No bullet points, no markdown headers, no emojis.\n` +
  `- Max 120 words.\n`;

// ── Prompt builders ────────────────────────────────────────────────────────────

// ─ Revenue ───────────────────────────────────────────────────────────────────
// data shape from Revenue.jsx onData:
//   { summary, daily, categories (full obj: {total, categories, breakdown}), weekly }
function buildRevenuePrompt(data, month, center) {
  const s   = data.summary   || {};
  const w   = data.weekly    || {};
  const cat = data.categories || {};  // { total, categories:[{category,revenue,percentage,invoice_count}], breakdown }

  const goalPct = (s.mtd_revenue != null && s.goal && s.goal > 0)
    ? pct((s.mtd_revenue / s.goal) * 100)
    : "N/A";

  const summaryBlock =
    `MTD Revenue: ${currency(s.mtd_revenue)}\n` +
    `Cash Sales (MTD): ${currency(s.cash_sales)}\n` +
    `Monthly Goal: ${currency(s.goal)}\n` +
    `Goal Attainment MTD: ${goalPct}\n` +
    `Yesterday Revenue: ${currency(s.yesterday_revenue)}\n` +
    `Projected (full month at current pace): ${currency(s.projected)}\n` +
    `Revenue/Day: ${currency(s.rev_per_day)}\n` +
    `Revenue/Hour: ${currency(s.rev_per_hour)}\n` +
    `30-day ADV: ${num(s.adv)}\n` +
    `ASP (revenue ÷ distinct invoices): ${currency(s.asp)}\n` +
    `Invoice Count: ${num(s.invoice_count)}\n` +
    `Days Elapsed: ${s.days_elapsed ?? "N/A"} of ${s.days_in_month ?? "N/A"}`;

  const weeklyBlock = (w.weeks || []).length > 0
    ? w.weeks.map(wk =>
        `  ${wk.week}: ${currency(wk.revenue)}${wk.wow != null ? ` (WoW ${signedPct(wk.wow)})` : ""}`
      ).join("\n") + `\n  Full-Month Pace: ${currency(w.full_month_pace)}`
    : "  No weekly data.";

  // FIXED: data.categories is the full response object {total, categories, breakdown}
  const catsBlock = (cat.categories || []).length > 0
    ? cat.categories.slice(0, 8).map(c =>
        `  ${c.category}: ${currency(c.revenue)} (${pct(c.percentage)}, ${num(c.invoice_count)} invoices)`
      ).join("\n")
    : "  No category data.";

  return (
    `You are a senior business analyst. Analyze ONLY the dashboard data below. ` +
    `Write 4-6 specific, data-backed insights.\n\n` +
    GROUNDING_RULES + `\n` +
    `Period: ${month}${center && center !== "All" ? ` · Center: ${center}` : " · All Centers"}\n\n` +
    `REVENUE SUMMARY:\n${summaryBlock}\n\n` +
    `WEEKLY BREAKDOWN:\n${weeklyBlock}\n\n` +
    `REVENUE BY CATEGORY (top 8):\n${catsBlock}\n\n` +
    `Focus on goal pacing, projection vs. goal, week-over-week trend, ` +
    `and which categories are driving or dragging revenue.`
  );
}

// ─ Leaderboard ───────────────────────────────────────────────────────────────
// data shape from Leaderboard.jsx onData:
//   { staff: {data, total}, serviceTypes: {data, total}, referrals: {data, total} }
function buildLeaderboardPrompt(data, month, center) {
  const staffRows = (data.staff?.data || []).slice(0, 10);
  const svcRows   = (data.serviceTypes?.data || []).slice(0, 8);
  const refRows   = (data.referrals?.data || []).slice(0, 6);

  const staffBlock = staffRows.length > 0
    ? staffRows.map(r =>
        `  #${r.rank} ${r.staff}: ${currency(r.revenue)} (${pct(r.share)} of total, ` +
        `${num(r.invoice_count)} invoices, ASP ${currency(r.asp)})`
      ).join("\n")
    : "  No staff data.";

  const svcBlock = svcRows.length > 0
    ? svcRows.map(r =>
        `  ${r.servicer}: ${currency(r.revenue)} (${pct(r.share)}, ${num(r.invoices)} invoices, ASP ${currency(r.asp)})`
      ).join("\n")
    : "  No servicer data.";

  const refBlock = refRows.length > 0
    ? refRows.map(r =>
        `  ${r.source}: ${num(r.count)} referrals (${pct(r.share)}), Revenue ${currency(r.revenue)}`
      ).join("\n")
    : "  No referral data.";

  return (
    `You are a senior business analyst. Analyze ONLY the dashboard data below. ` +
    `Write 4-6 specific, data-backed insights.\n\n` +
    GROUNDING_RULES + `\n` +
    `Period: ${month}${center && center !== "All" ? ` · Center: ${center}` : " · All Centers"}\n\n` +
    `STAFF REVENUE LEADERBOARD (top 10):\n${staffBlock}\n\n` +
    `REVENUE BY SERVICER (top 8):\n${svcBlock}\n\n` +
    `TOP REFERRAL SOURCES (top 6):\n${refBlock}\n\n` +
    `Focus on revenue concentration (how many staff drive the majority), ` +
    `ASP gaps between top and bottom performers, and which referral sources ` +
    `deliver the most volume vs. highest revenue-per-referral.`
  );
}

// ─ Appointments ──────────────────────────────────────────────────────────────
// data shape from Appointments.jsx onData:
//   { summary, byStatus, byCategory, byProvider, byBookingSource }
// NOTE: summary already contains rebook_rate + first_visit_rate from the merged backend query.
function buildAppointmentsPrompt(data, month, center) {
  const s = data.summary || {};

  const summaryBlock =
    `Total Appointments: ${num(s.total_appointments)}\n` +
    `Closed: ${num(s.closed)}\n` +
    `No-Shows: ${num(s.noshows)} (${pct(s.noshow_rate)})\n` +
    `Cancellations: ${num(s.cancelled)} (${pct(s.cancel_rate)})\n` +
    `Rebooked: ${num(s.rebooked)} → Rebook Rate: ${pct(s.rebook_rate)} (rebooked ÷ closed)\n` +
    `First Visits: ${num(s.first_visits)} (${pct(s.first_visit_rate)} of closed)\n` +
    `Surprise Visits: ${num(s.surprise_visits)}\n` +
    `Add-Ons: ${num(s.addons)}\n` +
    `Avg per Day: ${s.avg_per_day ?? "N/A"}\n` +
    `Avg Actual Duration: ${s.avg_actual_duration_min != null ? Math.round(s.avg_actual_duration_min) + " min" : "N/A"}\n` +
    `Utilisation (booked/scheduled): ${valOrMissing(s.utilisation_pct, pct)}`;

  const statusBlock = (data.byStatus?.data || []).length > 0
    ? data.byStatus.data.map(r => `  ${r.status}: ${num(r.count)} (${pct(r.pct)})`).join("\n")
    : "  No status breakdown.";

  const catBlock = (data.byCategory?.data || []).slice(0, 8).length > 0
    ? data.byCategory.data.slice(0, 8).map(r =>
        `  ${r.category}: ${num(r.count)} (${pct(r.pct)})`
      ).join("\n")
    : "  No category data.";

  const provBlock = (data.byProvider?.data || []).slice(0, 8).length > 0
    ? data.byProvider.data.slice(0, 8).map(r =>
        `  ${r.provider}: ${num(r.count)} appts, Rebook Rate ${pct(r.rebook_rate)}`
      ).join("\n")
    : "  No provider data.";

  const srcBlock = (data.byBookingSource?.data || []).slice(0, 6).length > 0
    ? data.byBookingSource.data.slice(0, 6).map(r =>
        `  ${r.source}: ${num(r.count)} (${pct(r.pct)})`
      ).join("\n")
    : "  No booking source data.";

  return (
    `You are a senior business analyst. Analyze ONLY the dashboard data below. ` +
    `Write 4-6 specific, data-backed insights.\n\n` +
    GROUNDING_RULES + `\n` +
    `Period: ${month}${center && center !== "All" ? ` · Center: ${center}` : " · All Centers"}\n\n` +
    `APPOINTMENT SUMMARY:\n${summaryBlock}\n\n` +
    `BY STATUS:\n${statusBlock}\n\n` +
    `BY SERVICE CATEGORY (top 8, Closed only):\n${catBlock}\n\n` +
    `BY PROVIDER (top 8):\n${provBlock}\n\n` +
    `BY BOOKING SOURCE (top 6):\n${srcBlock}\n\n` +
    `Focus on no-show and cancellation rates, rebook rate vs. first-visit rate, ` +
    `utilisation, and which providers or booking sources stand out.`
  );
}

// ─ Utilization ───────────────────────────────────────────────────────────────
// data shape from Utilization.jsx onData:
//   { providers, revPerHour, roleSummary }
//
// FIXED: original code read data.providerUtil and data.revenuePerHour
//        but Utilization.jsx sends data.providers and data.revPerHour.
//        All three key names corrected below.
function buildUtilizationPrompt(data, month, center) {
  // CORRECTED key names to match Utilization.jsx onData call:
  //   providers   (was: providerUtil)
  //   revPerHour  (was: revenuePerHour)
  //   roleSummary (unchanged — was already correct)
  const roleRows  = (data.roleSummary  || []);
  const provRows  = (data.providers    || []).slice(0, 10);   // FIXED: was data.providerUtil
  const revRows   = (data.revPerHour   || []).slice(0, 10);   // FIXED: was data.revenuePerHour

  const roleBlock = roleRows.length > 0
    ? roleRows.map(r =>
        `  ${r.role} (${num(r.headcount)} staff): ` +
        `Util ${pct(r.utilization_pct)}, Rev/Hr ${currency(r.rev_per_hour)}, ` +
        `Revenue ${currency(r.revenue)}, ` +
        `Booked ${num(r.booked_hours)} hr / Scheduled ${num(r.scheduled_hours)} hr`
      ).join("\n")
    : "  No role data.";

  const provBlock = provRows.length > 0
    ? provRows.map(r =>
        `  ${r.employee} (${r.role}, ${r.center}): ` +
        `Util ${pct(r.utilization_pct)}, ` +
        `Booked ${num(r.booked_hours)} hr / Scheduled ${num(r.scheduled_hours)} hr`
      ).join("\n")
    : "  No individual utilization data.";

  const revBlock = revRows.length > 0
    ? revRows.map(r =>
        `  ${r.employee} (${r.role}, ${r.center}): ` +
        `Rev/Hr ${currency(r.rev_per_hour)}, Revenue ${currency(r.revenue)}, ` +
        `Util ${pct(r.utilization_pct)}`
      ).join("\n")
    : "  No revenue-per-hour data.";

  return (
    `You are a senior business analyst. Analyze ONLY the dashboard data below. ` +
    `Write 4-6 specific, data-backed insights.\n\n` +
    GROUNDING_RULES + `\n` +
    `Period: ${month}${center && center !== "All" ? ` · Center: ${center}` : " · All Centers"}\n\n` +
    `UTILIZATION BY ROLE:\n${roleBlock}\n\n` +
    `TOP 10 INDIVIDUAL UTILIZATION:\n${provBlock}\n\n` +
    `TOP 10 REVENUE PER HOUR:\n${revBlock}\n\n` +
    `Focus on which roles or individuals are significantly above or below average ` +
    `utilization, and whether high utilization correlates with high rev/hr. ` +
    `Name specific employees and cite the exact numbers.`
  );
}

// ── Route to correct builder ──────────────────────────────────────────────────
function buildPrompt(tab, data, month, center) {
  if (tab === "revenue")      return buildRevenuePrompt(data, month, center);
  if (tab === "leaderboard")  return buildLeaderboardPrompt(data, month, center);
  if (tab === "appointments") return buildAppointmentsPrompt(data, month, center);
  if (tab === "utilization")  return buildUtilizationPrompt(data, month, center);
  return "No data available for this view.";
}

// ── Component ─────────────────────────────────────────────────────────────────
// Props:
//   tab     — "revenue" | "leaderboard" | "appointments" | "utilization"
//   data    — object collected by the active panel's onData callback
//   loading — true while the panel is fetching its data
//   month   — "YYYY-MM" string
//   center  — selected center string or "All"
export default function AiInsights({ tab, data, loading, month, center }) {
  const [aiLoading, setAiLoading] = useState(false);
  const [insight,   setInsight]   = useState("");
  const [error,     setError]     = useState("");

  const lastKeyRef      = useRef(null);
  const pendingKeyRef   = useRef(null);
  const mountedRef      = useRef(true);
  const abortRef        = useRef(null);
  // firstLoadDoneRef: skips the very first loading→false transition (cold open).
  // hasInteractedRef: flips true when the user changes tab/month/center for the
  //   first time, enabling auto-generate on subsequent data loads.
  const firstLoadDoneRef = useRef(false);
  const hasInteractedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // ── Generate ──────────────────────────────────────────────────────────────
  const generate = useCallback(async () => {
    if (!mountedRef.current) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAiLoading(true);
    setError("");
    setInsight("");

    const prompt = buildPrompt(tab, data, month, center);

    try {
      const res = await fetch(`${API}/api/insights`, {
        method:  "POST",
        signal:  controller.signal,
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tab, prompt, month, center }),
      });

      if (!mountedRef.current) return;

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail?.error || err?.detail || `Server error ${res.status}`);
      }

      const json = await res.json();
      setInsight(json.insight || "");
    } catch (e) {
      if (e.name === "AbortError" || !mountedRef.current) return;
      setError(e.message);
    }

    setAiLoading(false);
  }, [tab, data, month, center]); // eslint-disable-line

  // ── Auto-trigger on tab / month / center change ────────────────────────────
  useEffect(() => {
    if (!firstLoadDoneRef.current) return;

    hasInteractedRef.current = true;

    const key = `${tab}|${month}|${center}`;
    setInsight("");
    setError("");
    if (lastKeyRef.current === key) return;

    if (!loading) {
      lastKeyRef.current    = key;
      pendingKeyRef.current = null;
      generate();
    } else {
      pendingKeyRef.current = key;
    }
  }, [tab, month, center]); // eslint-disable-line

  // ── Fire once data finishes loading ───────────────────────────────────────
  useEffect(() => {
    if (loading) return;

    if (!firstLoadDoneRef.current) {
      firstLoadDoneRef.current = true;
      return;
    }

    if (!hasInteractedRef.current) return;

    const key = `${tab}|${month}|${center}`;
    if (lastKeyRef.current === key) return;

    lastKeyRef.current    = key;
    pendingKeyRef.current = null;
    generate();
  }, [loading]); // eslint-disable-line

  // ── UI ────────────────────────────────────────────────────────────────────
  const TAB_LABEL = {
    revenue:      "Revenue",
    leaderboard:  "Leaderboard",
    appointments: "Appointments",
    utilization:  "Utilization",
  };

  return (
    <div className="ai-insights-wrap">
      <div className="ai-insights-panel">
        <div className="ai-insights-header">
          <span className="ai-insights-title">✦ AI Insights</span>
          <span className="ai-insights-meta">
            {TAB_LABEL[tab] || tab} · {month}
            {center && center !== "All" ? ` · ${center}` : ""}
          </span>
          {!aiLoading && !loading && (
            <button
              className="ai-insights-btn"
              onClick={generate}
              disabled={aiLoading || loading}
              style={{ marginLeft: "auto" }}
            >
              ↻ Regenerate
            </button>
          )}
        </div>

        {(loading || aiLoading) && (
          <div className="ai-insights-loading">
            <span className="ai-pulse">●</span>
            <span className="ai-pulse" style={{ animationDelay: "0.2s" }}>●</span>
            <span className="ai-pulse" style={{ animationDelay: "0.4s" }}>●</span>
            &nbsp;{loading ? "Waiting for dashboard data…" : "Analyzing data…"}
          </div>
        )}

        {error && <div className="ai-insights-error">⚠ {error}</div>}

        {insight && !aiLoading && (
          <div className="ai-insights-body">
            {insight.split("\n").filter(Boolean).map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        )}

        {!loading && !aiLoading && !error && !insight && (
          <div className="ai-insights-loading" style={{ color: "#aaa" }}>
            Insights will appear here once data is loaded.
          </div>
        )}
      </div>
    </div>
  );
}
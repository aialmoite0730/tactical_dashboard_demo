import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
} from "recharts";
import {
  AppointmentsIcon, AlertCircleIcon, XCircleIcon, RepeatIcon, UserPlusIcon,
  TrendingUpIcon, ZapIcon, GaugeIcon, ClockIcon, PlusCircleIcon, AlertTriangleIcon,
} from "../Icons";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtNum = (n, dec = 0) =>
  (n ?? 0).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });

const post = async (base, path, body) => {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
};

// ─── Status palette ───────────────────────────────────────────────────────────
const STATUS_COLORS = {
  "Closed":           "var(--chart-cat-1)",
  "Closed (No Show)": "var(--chart-cat-4)",
  "Cancelled":        "var(--chart-cat-5)",
  "Open":             "var(--chart-cat-2)",
  "default":          "var(--chart-cat-3)",
};

const C = {
  bar:   "var(--accent-bar)",
  bar2:  "var(--secondary-brand)",
  grid:  "var(--grid)",
  muted: "var(--text-muted)",
  DONUT: [
    "var(--chart-cat-1)", "var(--chart-cat-2)", "var(--chart-cat-3)",
    "var(--chart-cat-4)", "var(--chart-cat-5)", "var(--chart-cat-6)",
    "var(--secondary-brand)", "var(--accent-bar)",
  ],
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function Skeleton({ h = 20, w = "100%" }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: 6,
      background: "var(--skeleton)",
      animation: "pulse 1.4s ease-in-out infinite",
    }} />
  );
}

function KpiCard({ label, value, sub, loading, highlight, note, icon }) {
  return (
    <div className={`kpi-card${highlight ? " kpi-card--highlight" : ""}`}>
      <div className="kpi-card-top">
        {icon && <div className="kpi-icon">{icon}</div>}
        <div className="kpi-label">{label}</div>
      </div>
      {loading ? <Skeleton h={28} w="70%" /> : <div className="kpi-value">{value ?? "—"}</div>}
      {sub  && !loading && <div className="kpi-sub">{sub}</div>}
      {note && !loading && <div className="kpi-note">{note}</div>}
    </div>
  );
}

function SCard({ title, children, style = {} }) {
  return (
    <div className="chart-card" style={style}>
      {title && <div className="chart-title">{title}</div>}
      {children}
    </div>
  );
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="tooltip-date">{label}</div>
      {payload.map(p => (
        <div key={p.name} className="tooltip-row" style={{ color: p.color }}>
          <span>{p.name}</span><span style={{ fontWeight: 700 }}>{fmtNum(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function HBar({ label, value, max, pctLabel, color = C.bar, subLabel }) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        fontSize: 11, marginBottom: 3,
      }}>
        <span style={{
          color: "var(--text)", fontWeight: 600,
          overflow: "hidden", textOverflow: "ellipsis",
          whiteSpace: "nowrap", maxWidth: "55%",
        }}>{label}</span>
        <span style={{ color: "var(--text-muted)", textAlign: "right", fontSize: 10 }}>
          {fmtNum(value)}&nbsp;
          <span style={{ color }}>{pctLabel}</span>
          {subLabel && <span style={{ marginLeft: 6, color: "var(--text-muted)" }}>{subLabel}</span>}
        </span>
      </div>
      <div style={{ height: 6, background: "var(--grid)", borderRadius: 3 }}>
        <div style={{
          height: 6, width: w + "%", background: color,
          borderRadius: 3, transition: "width .6s ease",
        }} />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
// UPDATED: accepts onData (bubbles fetched data to App.js for AI insights)
//          and aiInsights (render-prop that injects the AI panel)
export default function Appointments({ apiBase, month, center, onData, aiInsights }) {
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [summary,    setSummary]    = useState(null);
  const [daily,      setDaily]      = useState([]);
  const [statuses,   setStatuses]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [providers,  setProviders]  = useState([]);
  const [sources,    setSources]    = useState([]);
  const [hourly,     setHourly]     = useState([]);
  // NOTE: summary already returns rebook_rate + first_visit_rate + addons in the
  // merged backend query (appointments.py action="summary"). The separate
  // rebook_rate fetch is kept here for components that reference rebookData
  // directly, but the data is identical to summary fields.
  const [rebookData, setRebookData] = useState(null);

  const mkBody = useCallback(action => ({ action, month, center }), [month, center]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [sum, day, stat, cat, prov, src, hr, rb] = await Promise.all([
        post(apiBase, "/api/appointments", mkBody("summary")),
        post(apiBase, "/api/appointments", mkBody("daily")),
        post(apiBase, "/api/appointments", mkBody("by_status")),
        post(apiBase, "/api/appointments", mkBody("by_category")),
        post(apiBase, "/api/appointments", mkBody("by_provider")),
        post(apiBase, "/api/appointments", mkBody("by_booking_source")),
        post(apiBase, "/api/appointments", mkBody("by_hour")),
        post(apiBase, "/api/appointments", mkBody("rebook_rate")),
      ]);
      if (sum.error) throw new Error(sum.error);
      setSummary(sum);
      setDaily(day.data || []);
      setStatuses(stat.data || []);
      setCategories(cat.data || []);
      setProviders(prov.data || []);
      setSources(src.data || []);
      setHourly(hr.data || []);
      setRebookData(rb);

      // UPDATED: bubble all data needed by AiInsights buildAppointmentsPrompt
      onData?.(
        {
          summary:         sum,
          byStatus:        stat,
          byCategory:      cat,
          byProvider:      prov,
          byBookingSource: src,
        },
        false
      );
    } catch (e) {
      setError(e.message);
      onData?.({}, false);
    } finally {
      setLoading(false);
    }
  }, [apiBase, mkBody]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const maxProv = providers[0]?.count || 1;
  const maxSrc  = sources[0]?.count  || 1;

  return (
    <div className="dash-content">
      {error && <div className="error-bar"><AlertTriangleIcon size={14} />{error}</div>}

      {/* ── KPI Row 1: Volume + Rates ── */}
      <div className="kpi-row">
        <KpiCard highlight loading={loading} icon={<AppointmentsIcon size={17} />} label="Appointments MTD"
          value={summary ? fmtNum(summary.total_appointments) : null}
          sub={summary ? `${fmtNum(summary.closed)} completed` : null} />
        <KpiCard loading={loading} icon={<AlertCircleIcon size={17} />} label="No-Show Rate"
          value={summary ? summary.noshow_rate + "%" : null}
          sub={summary ? `${fmtNum(summary.noshows)} no-shows` : null} />
        <KpiCard loading={loading} icon={<XCircleIcon size={17} />} label="Cancellation Rate"
          value={summary ? summary.cancel_rate + "%" : null}
          sub={summary ? `${fmtNum(summary.cancelled)} cancelled` : null} />
        {/* CORRECTED: rebook_rate = rebooked / closed (not / total) */}
        <KpiCard loading={loading} icon={<RepeatIcon size={17} />} label="Rebook Rate"
          value={rebookData ? rebookData.rebook_rate + "%" : null}
          sub={rebookData ? `${fmtNum(rebookData.rebooked)} of ${fmtNum(rebookData.closed)} closed` : null} />
        <KpiCard loading={loading} icon={<UserPlusIcon size={17} />} label="First-Visit Rate"
          value={rebookData ? rebookData.first_visit_rate + "%" : null}
          sub={rebookData ? `${fmtNum(rebookData.first_visits)} new guests` : null} />
      </div>

      {/* ── KPI Row 2: Ops ── */}
      <div className="kpi-row">
        <KpiCard loading={loading} icon={<TrendingUpIcon size={17} />} label="Avg. Appts / Day"
          value={summary ? summary.avg_per_day : null} />
        <KpiCard loading={loading} icon={<ZapIcon size={17} />} label="Surprise Visits"
          value={summary ? fmtNum(summary.surprise_visits) : null} />
        <KpiCard loading={loading} icon={<GaugeIcon size={17} />} label="Utilisation"
          value={summary ? summary.utilisation_pct + "%" : null} />
        <KpiCard loading={loading} icon={<ClockIcon size={17} />} label="Avg. Duration"
          value={summary?.avg_actual_duration_min != null
            ? summary.avg_actual_duration_min + " min"
            : null} />
        <KpiCard loading={loading} icon={<PlusCircleIcon size={17} />} label="Add-ons"
          value={rebookData ? fmtNum(rebookData.addons) : null}
          sub="appts with add-on" />
      </div>

      {/* ── AI Insights panel (injected by App.js render-prop) ── */}
      {!loading && aiInsights && aiInsights()}

      {/* ── Daily trend + Status donut ── */}
      <div className="charts-row">
        <SCard title="Daily appointments — MTD trend">
          {loading ? <Skeleton h={200} /> : daily.length === 0
            ? <div className="chart-empty">No data for this period</div>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={daily} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: C.muted }}
                         tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: C.muted }} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="count" name="Appointments" fill="var(--accent)" radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
        </SCard>

        <SCard title="Appointments by status" style={{ display: "flex", flexDirection: "column" }}>
          {loading ? <Skeleton h={200} /> : statuses.length === 0
            ? <div className="chart-empty">No data</div>
            : (
              <>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={statuses} dataKey="count" nameKey="status"
                         cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={2}>
                      {statuses.map(r => (
                        <Cell key={r.status} fill={STATUS_COLORS[r.status] || STATUS_COLORS.default} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [fmtNum(v), n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="cat-legend">
                  {statuses.map(r => (
                    <div key={r.status} className="cat-legend-item">
                      <span className="cat-dot" style={{ background: STATUS_COLORS[r.status] || STATUS_COLORS.default }} />
                      <span className="cat-name">{r.status}</span>
                      <span className="cat-pct">{r.pct}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
        </SCard>
      </div>

      {/* ── Category + Hourly ── */}
      <div className="charts-row">
        <SCard title="Appointments by service category (Closed only)">
          {loading ? <Skeleton h={200} /> : categories.length === 0
            ? <div className="chart-empty">No data</div>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={categories} layout="vertical"
                          margin={{ top: 0, right: 40, left: 120, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9, fill: C.muted }} />
                  <YAxis type="category" dataKey="category"
                         tick={{ fontSize: 10, fill: "var(--text)" }} width={116} />
                  <Tooltip formatter={v => [fmtNum(v), "Appointments"]} />
                  <Bar dataKey="count" name="Appointments" radius={[0,3,3,0]}>
                    {categories.map((_, i) => <Cell key={i} fill={C.DONUT[i % C.DONUT.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
        </SCard>

        <SCard title="Appointment volume by hour">
          {loading ? <Skeleton h={200} /> : hourly.length === 0
            ? <div className="chart-empty">No data</div>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={hourly} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 9, fill: C.muted }} tickFormatter={h => h + ":00"} />
                  <YAxis tick={{ fontSize: 9, fill: C.muted }} />
                  <Tooltip
                    formatter={v => [fmtNum(v), "Appointments"]}
                    labelFormatter={h => `${h}:00 – ${h+1}:00`}
                  />
                  <Bar dataKey="count" name="Appointments" fill="var(--accent)" radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
        </SCard>
      </div>

      {/* ── Provider + Booking source ── */}
      <div className="charts-row">
        {/* UPDATED: shows rebook_rate per provider from new API field */}
        <SCard title="Top providers by appointment count">
          {loading
            ? [1,2,3,4,5].map(i => <div key={i} style={{ marginBottom: 10 }}><Skeleton h={28} /></div>)
            : providers.length === 0
              ? <div className="chart-empty">No data</div>
              : providers.map(r => (
                  <HBar
                    key={r.provider}
                    label={r.provider}
                    value={r.count}
                    max={maxProv}
                    pctLabel={r.pct + "%"}
                    color="var(--accent)"
                    subLabel={`✓ ${fmtNum(r.closed_count)} · rebook ${r.rebook_rate}%`}
                  />
                ))}
        </SCard>

        <SCard title="Appointments by booking source">
          {loading
            ? [1,2,3,4,5].map(i => <div key={i} style={{ marginBottom: 10 }}><Skeleton h={28} /></div>)
            : sources.length === 0
              ? <div className="chart-empty">No data</div>
              : sources.map(r => (
                  <HBar
                    key={r.source}
                    label={r.source}
                    value={r.count}
                    max={maxSrc}
                    pctLabel={r.pct + "%"}
                    color="var(--accent)"
                  />
                ))}
        </SCard>
      </div>

      {/* ── Weekly table ── */}
      <WeeklyTable apiBase={apiBase} month={month} center={center} />
    </div>
  );
}

// ─── Weekly sub-component ─────────────────────────────────────────────────────
function WeeklyTable({ apiBase, month, center }) {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    post(apiBase, "/api/appointments", { action: "weekly", month, center })
      .then(d => setRows(d.weeks || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiBase, month, center]);

  return (
    <div className="weekly-card">
      <table className="weekly-table">
        <thead>
          <tr>
            <th>Week</th>
            <th>Total</th>
            <th>Completed</th>
            <th>No-Shows</th>
            <th>Cancelled</th>
            <th>WoW</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                Loading…
              </td>
            </tr>
          )}
          {!loading && rows.map(r => (
            <tr key={r.week}>
              <td>{r.week}</td>
              <td>{fmtNum(r.total)}</td>
              <td>{fmtNum(r.closed)}</td>
              <td>{fmtNum(r.noshows)}</td>
              <td>{fmtNum(r.cancelled)}</td>
              <td>
                {r.wow == null
                  ? <span style={{ color: "var(--text-muted)" }}>—</span>
                  : <span className={r.wow >= 0 ? "wow-pos" : "wow-neg"}>
                      {r.wow >= 0 ? "+" : ""}{r.wow}%
                    </span>}
              </td>
            </tr>
          ))}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                No data
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
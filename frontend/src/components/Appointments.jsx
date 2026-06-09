import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
} from "recharts";

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

// ─── Confirmed status palette from sample data ────────────────────────────────
const STATUS_COLORS = {
  "Closed":           "#2d6a4f",
  "Closed (No Show)": "#9b1c1c",
  "Cancelled":        "#92400e",
  "Open":             "#b89a6a",
  "default":          "#aaa",
};

const C = {
  bar:   "#7a5c3e",
  bar2:  "#b89a6a",
  line:  "#3d2b1f",
  grid:  "#ede6da",
  muted: "#8a7a6a",
  DONUT: ["#3d2b1f","#7a5c3e","#b89a6a","#d4aa7d","#e8cfa8","#c9a96e","#8b6348","#a07850"],
};

// ─── Components ───────────────────────────────────────────────────────────────
function Skeleton({ h = 20, w = "100%" }) {
  return <div style={{ height: h, width: w, borderRadius: 6, background: "var(--skeleton)", animation: "pulse 1.4s ease-in-out infinite" }} />;
}

function KpiCard({ label, value, sub, loading, highlight }) {
  return (
    <div className="kpi-card" style={highlight ? { borderColor: "var(--accent-bar)" } : {}}>
      <div className="kpi-label">{label}</div>
      {loading ? <Skeleton h={28} w="70%" /> : <div className="kpi-value">{value ?? "—"}</div>}
      {sub && !loading && <div className="kpi-sub">{sub}</div>}
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

function HBar({ label, value, max, pctLabel, color = C.bar }) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
        <span style={{ color: "var(--text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>{label}</span>
        <span style={{ color: "var(--text-muted)" }}>{fmtNum(value)}&nbsp;<span style={{ color }}>{pctLabel}</span></span>
      </div>
      <div style={{ height: 6, background: "var(--grid)", borderRadius: 3 }}>
        <div style={{ height: 6, width: w + "%", background: color, borderRadius: 3, transition: "width .6s ease" }} />
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Appointments({ apiBase, month, center }) {
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [summary,    setSummary]    = useState(null);
  const [daily,      setDaily]      = useState([]);
  const [statuses,   setStatuses]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [providers,  setProviders]  = useState([]);
  const [sources,    setSources]    = useState([]);
  const [hourly,     setHourly]     = useState([]);
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
      setSummary(sum); setDaily(day.data || []); setStatuses(stat.data || []);
      setCategories(cat.data || []); setProviders(prov.data || []);
      setSources(src.data || []); setHourly(hr.data || []); setRebookData(rb);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [apiBase, mkBody]);

  useEffect(() => { load(); }, [load]);

  const maxProv = providers[0]?.count || 1;
  const maxSrc  = sources[0]?.count  || 1;

  return (
    <div className="dash-content">
      {error && <div className="error-bar">⚠ {error}</div>}

      {/* ── KPI Row 1 ── */}
      <div className="kpi-row">
        <KpiCard highlight loading={loading} label="Appointments MTD"
          value={summary ? fmtNum(summary.total_appointments) : null}
          sub={summary ? `${fmtNum(summary.closed)} completed` : null} />
        <KpiCard loading={loading} label="No-Show Rate"
          value={summary ? summary.noshow_rate + "%" : null}
          sub={summary ? `${fmtNum(summary.noshows)} no-shows` : null} />
        <KpiCard loading={loading} label="Cancellation Rate"
          value={summary ? summary.cancel_rate + "%" : null}
          sub={summary ? `${fmtNum(summary.cancelled)} cancelled` : null} />
        <KpiCard loading={loading} label="Rebook Rate"
          value={rebookData ? rebookData.rebook_rate + "%" : null}
          sub={rebookData ? `${fmtNum(rebookData.rebooked)} rebooked` : null} />
        <KpiCard loading={loading} label="First-Visit Rate"
          value={rebookData ? rebookData.first_visit_rate + "%" : null}
          sub={rebookData ? `${fmtNum(rebookData.first_visits)} new guests` : null} />
      </div>

      {/* ── KPI Row 2 ── */}
      <div className="kpi-row">
        <KpiCard loading={loading} label="Avg. Appts / Day"
          value={summary ? summary.avg_per_day : null} />
        <KpiCard loading={loading} label="Surprise Visits"
          value={summary ? fmtNum(summary.surprise_visits) : null} />
        <KpiCard loading={loading} label="Utilisation"
          value={summary ? summary.utilisation_pct + "%" : null}
          sub="scheduled vs 10h capacity" />
        <KpiCard loading={loading} label="Avg. Duration"
          value={summary ? summary.avg_actual_duration_min + " min" : null} />
        <KpiCard loading={loading} label="Add-ons"
          value={rebookData ? fmtNum(rebookData.addons) : null}
          sub="appts with add-on" />
      </div>

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
                  <Bar dataKey="count" name="Appointments" fill={C.bar} radius={[2,2,0,0]} />
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

        <SCard title="Appointment volume by hour (EST)">
          {loading ? <Skeleton h={200} /> : hourly.length === 0
            ? <div className="chart-empty">No data</div>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={hourly} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 9, fill: C.muted }} tickFormatter={h => h + ":00"} />
                  <YAxis tick={{ fontSize: 9, fill: C.muted }} />
                  <Tooltip formatter={v => [fmtNum(v), "Appointments"]} labelFormatter={h => h + ":00 – " + (h+1) + ":00"} />
                  <Bar dataKey="count" name="Appointments" fill={C.bar2} radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
        </SCard>
      </div>

      {/* ── Provider + Booking source ── */}
      <div className="charts-row">
        <SCard title="Top providers by appointment count">
          {loading
            ? [1,2,3,4,5].map(i => <div key={i} style={{marginBottom:10}}><Skeleton h={28}/></div>)
            : providers.length === 0
              ? <div className="chart-empty">No data</div>
              : providers.map(r => (
                  <HBar key={r.provider} label={r.provider} value={r.count}
                        max={maxProv} pctLabel={r.pct + "%"} color={C.bar} />
                ))}
        </SCard>

        <SCard title="Appointments by booking source">
          {loading
            ? [1,2,3,4,5].map(i => <div key={i} style={{marginBottom:10}}><Skeleton h={28}/></div>)
            : sources.length === 0
              ? <div className="chart-empty">No data</div>
              : sources.map(r => (
                  <HBar key={r.source} label={r.source} value={r.count}
                        max={maxSrc} pctLabel={r.pct + "%"} color={C.bar2} />
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
            <tr><td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>Loading…</td></tr>
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
                  : <span className={r.wow >= 0 ? "wow-pos" : "wow-neg"}>{r.wow >= 0 ? "+" : ""}{r.wow}%</span>}
              </td>
            </tr>
          ))}
          {!loading && rows.length === 0 && (
            <tr><td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>No data</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
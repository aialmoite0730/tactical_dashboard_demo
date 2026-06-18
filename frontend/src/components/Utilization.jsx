import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  GaugeIcon, ClockIcon, CalendarIcon, TrendingUpIcon, DollarIcon, AlertTriangleIcon,
} from "../Icons";

const fmtNum = (n, dec = 0) =>
  (n ?? 0).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });

function fmt(n, compact = false) {
  if (n === null || n === undefined) return "$—";
  if (compact && n >= 1_000_000) return `$${(n/1_000_000).toFixed(2)}M`;
  if (compact && n >= 1_000)     return `$${(n/1_000).toFixed(0)}K`;
  return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n);
}

const C = {
  bar:   "var(--accent-bar)",
  grid:  "var(--grid)",
  muted: "var(--text-muted)",
  good:  "var(--positive)",
  warn:  "var(--warning)",
  crit:  "var(--negative)",
  ROLE:  ["var(--accent)", "var(--secondary-brand)", "var(--accent-bar)", "var(--champagne)", "var(--sand)"],
};

function Skeleton({ h = 20, w = "100%" }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: 6,
      background: "var(--skeleton)",
      animation: "pulse 1.4s ease-in-out infinite",
    }}/>
  );
}

function KpiCard({ label, value, sub, highlight, icon }) {
  return (
    <div className={`kpi-card${highlight ? " kpi-card--highlight" : ""}`}>
      <div className="kpi-card-top">
        {icon && <div className="kpi-icon">{icon}</div>}
        <div className="kpi-label">{label}</div>
      </div>
      <div className="kpi-value">{value ?? "—"}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function UtilBar({ label, role, scheduledHrs, bookedHrs, utilPct, revPerHour }) {
  const color = utilPct >= 80 ? C.good : utilPct >= 50 ? C.warn : C.crit;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
        <div>
          <span style={{ fontWeight: 700, color: "var(--text)" }}>{label}</span>
          {role && <span style={{ marginLeft: 6, fontSize: 10, color: C.muted }}>{role}</span>}
        </div>
        <div style={{ textAlign: "right", fontSize: 10, color: C.muted }}>
          <span style={{ color, fontWeight: 700 }}>{utilPct}%</span>
          <span style={{ margin: "0 6px" }}>·</span>
          {fmtNum(bookedHrs, 1)}h / {fmtNum(scheduledHrs, 1)}h
          {revPerHour != null && (
            <span style={{ marginLeft: 6, color: "var(--text)" }}>{fmt(revPerHour, true)}/hr</span>
          )}
        </div>
      </div>
      <div style={{ height: 7, background: "var(--grid)", borderRadius: 4 }}>
        <div style={{
          height: 7, width: Math.min(utilPct, 100) + "%",
          background: color, borderRadius: 4, transition: "width .6s ease",
        }}/>
      </div>
    </div>
  );
}

const post = async (base, body) => {
  const res = await fetch(`${base}/api/utilization`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export default function Utilization({ apiBase, month, center, onData, aiInsights }) {
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [providers,   setProviders]   = useState([]);
  const [revPerHour,  setRevPerHour]  = useState([]);
  const [roleSummary, setRoleSummary] = useState([]);
  const [loaded,      setLoaded]      = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null); setLoaded(false);
    try {
      const [pu, rph, rs] = await Promise.all([
        post(apiBase, { action: "provider_utilization", month, center }),
        post(apiBase, { action: "revenue_per_hour",     month, center }),
        post(apiBase, { action: "role_summary",         month, center }),
      ]);
      if (pu.error) throw new Error(pu.error);
      setProviders(pu.data   || []);
      setRevPerHour(rph.data || []);
      setRoleSummary(rs.data || []);
      setLoaded(true);
      onData?.({ providers: pu.data || [], revPerHour: rph.data || [], roleSummary: rs.data || [] }, false);
    } catch (e) {
      setError(e.message);
      onData?.({}, false);
    } finally {
      setLoading(false);
    }
  }, [apiBase, month, center]);

  useEffect(() => { load(); }, [load]);

  // Summary KPIs derived from role data
  const totalSched  = roleSummary.reduce((s, r) => s + r.scheduled_hours, 0);
  const totalBooked = roleSummary.reduce((s, r) => s + r.booked_hours, 0);
  const totalRev    = roleSummary.reduce((s, r) => s + r.revenue, 0);
  const avgUtil     = totalSched > 0 ? ((totalBooked / totalSched) * 100).toFixed(1) : "—";
  const avgRevHr    = totalBooked > 0 ? totalRev / totalBooked : 0;

  return (
    <div className="dash-content">
      {error && <div className="error-bar"><AlertTriangleIcon size={14} />{error}</div>}

      {/* ── Summary KPIs ── */}
      <div className="kpi-row">
        <KpiCard highlight icon={<GaugeIcon size={17} />} label="Avg. Utilisation"
          value={avgUtil !== "—" ? avgUtil + "%" : "—"}
          sub="booked ÷ scheduled hrs" />
        <KpiCard icon={<ClockIcon size={17} />} label="Total Booked Hours"
          value={fmtNum(totalBooked, 1) + " h"} />
        <KpiCard icon={<CalendarIcon size={17} />} label="Total Sched. Hours"
          value={fmtNum(totalSched, 1) + " h"} />
        <KpiCard icon={<TrendingUpIcon size={17} />} label="Revenue / Util. Hour"
          value={fmt(avgRevHr, true)}
          sub="total rev ÷ booked hrs" />
        <KpiCard icon={<DollarIcon size={17} />} label="Total Revenue (linked)"
          value={fmt(totalRev, true)} />
      </div>

      {/* ── AI Insights ── */}
      {loaded && aiInsights && aiInsights()}

      {/* ── Role summary table ── */}
      {loading ? (
        <div className="chart-card"><Skeleton h={120} /></div>
      ) : loaded && roleSummary.length > 0 ? (
        <div className="weekly-card">
          <div style={{ padding: "10px 16px 6px", fontSize: 11, color: C.muted, fontStyle: "italic" }}>
            Utilization &amp; Revenue by Role — joined on serviced_by + date + center
          </div>
          <table className="weekly-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Staff</th>
                <th>Sched. Hrs</th>
                <th>Booked Hrs</th>
                <th>Util %</th>
                <th>Revenue</th>
                <th>Rev / Hr</th>
              </tr>
            </thead>
            <tbody>
              {roleSummary.map(r => (
                <tr key={r.role}>
                  <td>{r.role}</td>
                  <td style={{ textAlign: "right" }}>{r.headcount}</td>
                  <td style={{ textAlign: "right" }}>{fmtNum(r.scheduled_hours, 1)}</td>
                  <td style={{ textAlign: "right" }}>{fmtNum(r.booked_hours, 1)}</td>
                  <td style={{ textAlign: "right" }}>
                    <span style={{
                      fontWeight: 700,
                      color: r.utilization_pct >= 80 ? C.good : r.utilization_pct >= 50 ? C.warn : C.crit,
                    }}>
                      {r.utilization_pct}%
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>{fmt(r.revenue, true)}</td>
                  <td style={{ textAlign: "right" }}>{fmt(r.rev_per_hour, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="charts-row">
        {/* ── Provider utilization bars ── */}
        <div className="chart-card">
          <div className="chart-title">Provider utilization — booked ÷ scheduled hours</div>
          {loading
            ? [1,2,3,4,5].map(i => <div key={i} style={{ marginBottom: 12 }}><Skeleton h={32} /></div>)
            : providers.length === 0
              ? <div className="chart-empty">No schedule data</div>
              : providers.map(r => (
                  <UtilBar
                    key={r.employee + r.center}
                    label={r.employee}
                    role={r.role}
                    scheduledHrs={r.scheduled_hours}
                    bookedHrs={r.booked_hours}
                    utilPct={r.utilization_pct}
                    revPerHour={null}
                  />
                ))}
        </div>

        {/* ── Revenue per hour bars ── */}
        <div className="chart-card">
          <div className="chart-title">Revenue per utilized hour — sales ÷ booked hrs</div>
          {loading
            ? [1,2,3,4,5].map(i => <div key={i} style={{ marginBottom: 12 }}><Skeleton h={32} /></div>)
            : revPerHour.length === 0
              ? <div className="chart-empty">No data — check join: serviced_by + date + center</div>
              : revPerHour.map(r => (
                  <UtilBar
                    key={r.employee + r.center}
                    label={r.employee}
                    role={r.role}
                    scheduledHrs={r.scheduled_hours}
                    bookedHrs={r.booked_hours}
                    utilPct={r.utilization_pct}
                    revPerHour={r.rev_per_hour}
                  />
                ))}
        </div>
      </div>

      {/* ── Revenue per hour bar chart (top 10) ── */}
      {loaded && revPerHour.length > 0 && (
        <div className="chart-card">
          <div className="chart-title">Revenue per utilized hour — top 10 providers</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={revPerHour.slice(0, 10)}
              layout="vertical"
              margin={{ top: 0, right: 60, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
              <XAxis type="number"
                tickFormatter={v => `$${(v).toFixed(0)}`}
                tick={{ fontSize: 9, fill: C.muted }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="employee" width={110}
                tick={{ fontSize: 10, fill: "var(--text)" }} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(v, n, p) => [
                  `${fmt(v, true)}/hr · util ${p.payload.utilization_pct}%`,
                  p.payload.employee,
                ]}
              />
              <Bar dataKey="rev_per_hour" name="Rev/hr" radius={[0,3,3,0]} maxBarSize={14}>
                {revPerHour.slice(0, 10).map((_, i) => (
                  <Cell key={i} fill={C.ROLE[i % C.ROLE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
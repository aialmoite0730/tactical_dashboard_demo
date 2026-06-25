import { useState, useEffect, useCallback, useRef } from "react";
import {
  DollarIcon, ZapIcon, UserPlusIcon, TrendingUpIcon, ChartBarIcon,
  RepeatIcon, StarIcon, AlertTriangleIcon,
} from "../Icons";

// ── Formatters (match reference: no $ prefix, 2-decimal amounts) ──────────────
function amt(n)   { return (n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function int(n)   { return new Intl.NumberFormat("en-US").format(Math.round(n || 0)); }
function pct(n)   { return `${((n || 0) * 100).toFixed(2)}%`; }
function pct1(n)  { return `${((n || 0) * 100).toFixed(1)}%`; }

function AnimNum({ value, decimals = 2 }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const start = prev.current, end = value, dur = 700, t0 = performance.now();
    const step = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(start + (end - start) * e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    prev.current = value;
  }, [value]);
  const formatted = display.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{formatted}</span>
  );
}

function KpiCard({ label, value, sub, icon, decimals = 2 }) {
  return (
    <div className="kpi-card">
      <div className="kpi-card-top">
        {icon && <div className="kpi-icon">{icon}</div>}
        <div className="kpi-label">{label}</div>
      </div>
      <div className="kpi-value"><AnimNum value={value ?? 0} decimals={decimals} /></div>
      {sub && <div className="kpi-note">{sub}</div>}
    </div>
  );
}

function Skeleton({ h = "18px", w = "100%", mb = "0" }) {
  return <div style={{ height: h, width: w, borderRadius: 4, background: "var(--skeleton)", marginBottom: mb, animation: "pulse 1.4s ease infinite" }} />;
}

// ── Funnel (4 stages) ──────────────────────────────────────────────────────────
function Funnel({ f }) {
  const stages = [
    { key: "blue",   title: "1. AD SPEND",            icon: <DollarIcon size={26} />,    value: amt(f.ad_spend),          label: "Total Spend",  rate: pct(f.click_rate) },
    { key: "teal",   title: "2. CLICKS",              icon: <ZapIcon size={26} />,       value: int(f.clicks),            label: "Total Clicks", rate: pct(f.new_client_rate) },
    { key: "green",  title: "3. NEW CLIENTS",         icon: <UserPlusIcon size={26} />,  value: int(f.new_clients),       label: "New Clients",  rate: amt(f.rev_per_new_client) },
    { key: "purple", title: "4. REVENUE FROM NEW CLIENTS", icon: <ChartBarIcon size={26} />, value: amt(f.new_client_revenue), label: "Revenue",   rate: null },
  ];
  return (
    <div className="mkt-funnel">
      {stages.map((s, i) => (
        <div key={s.key} className="mkt-funnel-row">
          <div className={`mkt-stage mkt-stage--${s.key}`}>
            <div className="mkt-stage-title">{s.title}</div>
            <div className="mkt-stage-icon">{s.icon}</div>
            <div className="mkt-stage-value">{s.value}</div>
            <div className="mkt-stage-label">{s.label}</div>
            {s.rate && <div className="mkt-stage-rate">{s.rate}</div>}
          </div>
          {i < stages.length - 1 && <div className="mkt-arrow">→</div>}
        </div>
      ))}
    </div>
  );
}

// ── Spend-by-source table ────────────────────────────────────────────────────
function SourceTable({ rows, total }) {
  if (!rows?.length) return <div className="chart-empty">No spend data</div>;
  return (
    <div className="mkt-box">
      <h3>Spend by Source</h3>
      <table className="mkt-table">
        <thead>
          <tr><th>Source</th><th>Ad Spend</th><th>% of Total</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.source}>
              <td>{r.source}</td>
              <td>{amt(r.ad_spend)}</td>
              <td>{pct1(r.pct_total_spend)}</td>
            </tr>
          ))}
          <tr className="mkt-total-row">
            <td>Total</td><td>{amt(total)}</td><td>100.0%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Funnel-performance table ─────────────────────────────────────────────────
function FunnelTable({ f }) {
  return (
    <div className="mkt-box">
      <h3>Funnel Performance Overview</h3>
      <table className="mkt-table">
        <thead>
          <tr><th>Stage</th><th>Count / Amount</th><th>% of Previous</th><th>% of Ad Spend</th></tr>
        </thead>
        <tbody>
          <tr><td>Ad Spend</td><td>{amt(f.ad_spend)}</td><td>–</td><td>100.00%</td></tr>
          <tr><td>Clicks</td><td>{int(f.clicks)}</td><td>{pct(f.click_rate)}</td><td>{pct(f.click_rate)}</td></tr>
          <tr><td>New Clients</td><td>{int(f.new_clients)}</td><td>{pct(f.new_client_rate)}</td><td>{pct(f.ad_spend ? f.new_clients / f.ad_spend : 0)}</td></tr>
          <tr><td>Revenue from New Clients</td><td>{amt(f.new_client_revenue)}</td><td>{pct(f.rev_per_new_client)}</td><td>{pct(f.revenue_vs_spend)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

export default function Marketing({ apiBase, month, center, onData, aiInsights }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [funnel,  setFunnel]  = useState(null);
  const [sources, setSources] = useState([]);
  const [loaded,  setLoaded]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(""); setLoaded(false);
    try {
      const post = (action) => fetch(`${apiBase}/api/marketing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, month, center }),
      }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

      const [f, s] = await Promise.all([post("funnel"), post("by_source")]);
      if (f.error) throw new Error(f.error);
      setFunnel(f);
      setSources(s.data || []);
      setLoaded(true);
      onData?.({ funnel: f, sources: s.data || [] }, false);
    } catch (e) {
      setError(e.message || "Failed to load data");
      onData?.({}, false);
    } finally {
      setLoading(false);
    }
  }, [apiBase, month, center]);

  useEffect(() => { load(); }, [load]);

  const totalSpend = sources.reduce((a, r) => a + (r.ad_spend || 0), 0);

  return (
    <div className="dash-content">
      {error && <div className="error-bar"><AlertTriangleIcon size={14} />{error}</div>}

      {center && center !== "All" && (
        <div className="mkt-note">
          Ad spend is account-wide; the center filter applies to clients &amp; revenue only.
        </div>
      )}

      {/* ── Funnel ── */}
      {loading ? (
        <div className="loading-chart-row"><div className="chart-card"><Skeleton h="300px" /></div></div>
      ) : loaded && funnel ? (
        <Funnel f={funnel} />
      ) : null}

      {/* ── KPI cards ── */}
      {loading ? (
        <div className="loading-row">
          {[100, 90, 80, 70].map((w, i) => (
            <div key={i} className="kpi-card">
              <Skeleton h="10px" w="60%" mb="8px" /><Skeleton h="24px" w={`${w}%`} />
            </div>
          ))}
        </div>
      ) : loaded && funnel ? (
        <div className="kpi-row">
          <KpiCard icon={<DollarIcon size={17} />}     label="Cost of Acquisition (CAC)" value={funnel.cac}                sub="Ad Spend / New Clients" decimals={2} />
          <KpiCard icon={<RepeatIcon size={17} />}     label="Returning Clients"         value={funnel.returning_clients}  sub="Total returning clients" decimals={0} />
          <KpiCard icon={<StarIcon size={17} />}       label="Revenue per New Client"    value={funnel.rev_per_new_client} sub="New-client rev / new clients" decimals={2} />
          <KpiCard icon={<TrendingUpIcon size={17} />} label="Return on Ad Spend (ROAS)" value={funnel.roas}               sub="New-client rev / ad spend" decimals={2} />
        </div>
      ) : null}

      {/* ── AI Insights ── */}
      {loaded && aiInsights && aiInsights()}

      {/* ── Tables ── */}
      {loading ? (
        <div className="loading-chart-row">
          <div className="chart-card"><Skeleton h="180px" /></div>
          <div className="chart-card"><Skeleton h="180px" /></div>
        </div>
      ) : loaded && funnel ? (
        <div className="mkt-table-grid">
          <SourceTable rows={sources} total={totalSpend} />
          <FunnelTable f={funnel} />
        </div>
      ) : null}
    </div>
  );
}

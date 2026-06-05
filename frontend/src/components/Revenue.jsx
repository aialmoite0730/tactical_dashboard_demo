import { useState, useEffect, useCallback, useRef } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";

const DONUT_COLORS = ["#3d2b1f","#7a5c3e","#c4a882","#e8d5b0","#a0845c","#5c3d28","#d4b896","#f0e6d3"];

function fmt(n, compact = false) {
  if (n === null || n === undefined) return "$—";
  if (compact && n >= 1_000_000) return `$${(n/1_000_000).toFixed(2)}M`;
  if (compact && n >= 1_000)     return `$${(n/1_000).toFixed(0)}K`;
  return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n);
}
function fmtPct(v) {
  if (v === null || v === undefined) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function fmtAxisY(v)  { return `$${(v/1000).toFixed(0)}K`; }
function fmtAxisY2(v) { return `$${(v/1_000_000).toFixed(1)}M`; }
function fmtDate(s)   {
  if (!s) return "";
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
}

function AnimNum({ value }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const start = prev.current, end = value, dur = 700, t0 = performance.now();
    const step = (now) => {
      const p = Math.min((now-t0)/dur, 1);
      const e = 1 - Math.pow(1-p, 3);
      setDisplay(start + (end-start)*e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    prev.current = value;
  }, [value]);
  const neg = display < 0;
  const formatted = Math.abs(display).toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0});
  return (
    <span style={{display:"inline-flex",alignItems:"center",fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>
      {neg && <span>−</span>}$<span>{formatted}</span>
    </span>
  );
}

function KpiCard({ label, value, subLabel, subValue, highlight }) {
  return (
    <div className={`kpi-card${highlight ? " kpi-card--highlight" : ""}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value"><AnimNum value={value ?? 0} /></div>
      {subValue !== undefined && (
        <div className="kpi-sub">
          <span className="kpi-sub-label">{subLabel}&nbsp;</span>
          <AnimNum value={subValue ?? 0} />
        </div>
      )}
    </div>
  );
}

function GoalBar({ mtd, goal }) {
  if (!goal) return null;
  const pct = Math.min((mtd / goal) * 100, 100);
  return (
    <div className="goal-bar-wrap">
      <div className="goal-bar-header">
        <span>Goal progress</span>
        <span>{fmt(mtd, true)} / {fmt(goal, true)} &nbsp;({pct.toFixed(1)}%)</span>
      </div>
      <div className="goal-bar-track">
        <div className="goal-bar-fill" style={{width:`${pct}%`}}/>
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="tooltip-date">{fmtDate(label)}</div>
      {payload.map(p => (
        <div key={p.name} className="tooltip-row" style={{color:p.color}}>
          <span>{p.name}:</span><span>{fmt(p.value, true)}</span>
        </div>
      ))}
    </div>
  );
}

function RevenueChart({ data }) {
  if (!data?.length) return <div className="chart-empty">No data for this period</div>;
  return (
    <div className="chart-card">
      <div className="chart-title">Daily revenue · MTD cumulative · Goal pace</div>
      <div className="chart-legend-row">
        <span style={{color:"var(--accent-bar)"}}>■ Daily</span>
        <span style={{color:"var(--accent-line)"}}>— MTD</span>
        <span style={{color:"var(--accent-goal)"}}>- - Goal</span>
      </div>
      <div style={{display:"flex",gap:0}}>
        <div style={{display:"flex",alignItems:"center",writingMode:"vertical-rl",transform:"rotate(180deg)",fontSize:9,color:"var(--text-muted)",padding:"0 2px",whiteSpace:"nowrap"}}>Daily ($)</div>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={data} margin={{top:8,right:8,left:0,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false}/>
            <XAxis dataKey="date" tickFormatter={fmtDate} tick={{fontSize:9,fill:"var(--text-muted)"}} tickLine={false} axisLine={false} interval={2}/>
            <YAxis yAxisId="left" tickFormatter={fmtAxisY} tick={{fontSize:9,fill:"var(--text-muted)"}} tickLine={false} axisLine={false} width={44}/>
            <YAxis yAxisId="right" orientation="right" tickFormatter={fmtAxisY2} tick={{fontSize:9,fill:"var(--text-muted)"}} tickLine={false} axisLine={false} width={48}/>
            <Tooltip content={<ChartTooltip/>}/>
            <Bar yAxisId="left" dataKey="daily_revenue" name="Daily revenue" fill="var(--accent-bar)" radius={[2,2,0,0]} maxBarSize={16}/>
            <Line yAxisId="right" type="monotone" dataKey="mtd_cumulative" name="MTD cumulative" stroke="var(--accent-line)" strokeWidth={2} dot={false}/>
            <Line yAxisId="right" type="monotone" dataKey="goal_mtd" name="Goal MTD" stroke="var(--accent-goal)" strokeWidth={1.5} strokeDasharray="5 3" dot={false}/>
          </ComposedChart>
        </ResponsiveContainer>
        <div style={{display:"flex",alignItems:"center",writingMode:"vertical-rl",fontSize:9,color:"var(--text-muted)",padding:"0 2px",whiteSpace:"nowrap"}}>MTD / Goal ($)</div>
      </div>
    </div>
  );
}

function CategoryChart({ data }) {
  if (!data?.length) return <div className="chart-empty">No category data</div>;
  return (
    <div className="chart-card category-card">
      <div className="chart-title">Revenue by item category</div>
      <ResponsiveContainer width="100%" height={190}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={52} outerRadius={82}
               dataKey="revenue" nameKey="category" paddingAngle={2}>
            {data.map((entry, i) => (
              <Cell key={entry.category} fill={DONUT_COLORS[i % DONUT_COLORS.length]}/>
            ))}
          </Pie>
          <Tooltip formatter={(v,n,p) => [fmt(v,true), p.payload.category]}/>
        </PieChart>
      </ResponsiveContainer>
      <div className="cat-legend">
        {data.map((d, i) => (
          <div key={d.category} className="cat-legend-item">
            <span className="cat-dot" style={{background:DONUT_COLORS[i%DONUT_COLORS.length]}}/>
            <span className="cat-name">{d.category}</span>
            <span className="cat-pct">{d.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeeklyTable({ weekly }) {
  const { weeks=[], full_month_pace=0 } = weekly || {};
  return (
    <div className="weekly-card">
      <table className="weekly-table">
        <thead><tr><th>Week</th><th>Revenue</th><th>WoW</th></tr></thead>
        <tbody>
          {weeks.map(w => (
            <tr key={w.week}>
              <td>{w.week}</td>
              <td>{fmt(w.revenue)}</td>
              <td className={w.wow===null?"":w.wow>=0?"wow-pos":"wow-neg"}>
                {w.wow===null?"—":fmtPct(w.wow)}
              </td>
            </tr>
          ))}
          <tr className="pace-row">
            <td>Full month pace</td><td>{fmt(full_month_pace)}</td><td/>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Skeleton({ h="18px", w="100%", mb="0" }) {
  return <div style={{height:h,width:w,borderRadius:4,background:"var(--skeleton)",marginBottom:mb,animation:"pulse 1.4s ease infinite"}}/>;
}

export default function Revenue({ apiBase, month, center }) {
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [summary,  setSummary]  = useState(null);
  const [daily,    setDaily]    = useState([]);
  const [cats,     setCats]     = useState([]);
  const [weekly,   setWeekly]   = useState(null);
  const [loaded,   setLoaded]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(""); setLoaded(false);
    try {
      const post = (action) => fetch(`${apiBase}/api/revenue`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action, month, center }),
      }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

      const [s, d, c, w] = await Promise.all([
        post("summary"), post("daily"), post("categories"), post("weekly"),
      ]);
      if (s.error) throw new Error(s.error);
      setSummary(s); setDaily(d.data||[]); setCats(c.data||[]); setWeekly(w);
      setLoaded(true);
    } catch(e) {
      setError(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [apiBase, month, center]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="dash-content">
      {error && <div className="error-bar">⚠ {error}</div>}

      {loading ? (
        <div className="loading-row">
          {[100,90,80,70,60].map((w,i)=>(
            <div key={i} className="kpi-card">
              <Skeleton h="10px" w="60%" mb="8px"/><Skeleton h="24px" w={`${w}%`}/>
            </div>
          ))}
        </div>
      ) : loaded ? (
        <>
          {summary?.goal > 0 && <GoalBar mtd={summary.mtd_revenue} goal={summary.goal}/>}
          <div className="kpi-row">
            <KpiCard label="MTD Revenue"  value={summary?.mtd_revenue}  subLabel="Yest:" subValue={summary?.yesterday_revenue} highlight/>
            <KpiCard label="Projected"    value={summary?.projected}/>
            <KpiCard label="Rev / Day"    value={summary?.rev_per_day}/>
            <KpiCard label="Rev / Hour"   value={summary?.rev_per_hour}/>
            <KpiCard label="30-Day ADV"   value={summary?.adv}/>
          </div>
        </>
      ) : null}

      {loading ? (
        <div className="loading-chart-row">
          <div className="chart-card"><Skeleton h="260px"/></div>
          <div className="chart-card"><Skeleton h="260px"/></div>
        </div>
      ) : loaded ? (
        <div className="charts-row">
          <RevenueChart data={daily}/>
          <CategoryChart data={cats}/>
        </div>
      ) : null}

      {loading ? (
        <div className="weekly-card" style={{padding:16}}><Skeleton h="140px"/></div>
      ) : loaded ? (
        <WeeklyTable weekly={weekly}/>
      ) : null}
    </div>
  );
}

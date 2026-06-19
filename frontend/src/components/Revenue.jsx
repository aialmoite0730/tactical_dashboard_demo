import { useState, useEffect, useCallback, useRef } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import {
  DollarIcon, TrendingUpIcon, CalendarIcon, ClockIcon, StarIcon,
  AlertTriangleIcon, ArrowUpIcon, ArrowDownIcon, ChevronDownIcon,
  CashPieArt,
} from "../Icons";

// Import the PNG images for ASP and Cash
import dropperAspImg from "../assets/icon-asp-dropper.png";
import cashStackImg from "../assets/icon-cash-stack.png";

const DONUT_COLORS = [
  "var(--chart-cat-1)", "var(--chart-cat-2)", "var(--chart-cat-3)",
  "var(--chart-cat-4)", "var(--chart-cat-5)", "var(--chart-cat-6)",
  "var(--secondary-brand)", "var(--accent-bar)",
];

function fmt(n, compact = false) {
  if (n === null || n === undefined) return "$—";
  if (compact && n >= 1_000_000) return `$${(n/1_000_000).toFixed(2)}M`;
  if (compact && n >= 1_000)     return `$${(n/1_000).toFixed(0)}K`;
  return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n);
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

function KpiCard({ label, value, subLabel, subValue, highlight, note, icon }) {
  return (
    <div className={`kpi-card${highlight ? " kpi-card--highlight" : ""}`}>
      <div className="kpi-card-top">
        {icon && <div className="kpi-icon">{icon}</div>}
        <div className="kpi-label">{label}</div>
      </div>
      <div className="kpi-value"><AnimNum value={value ?? 0} /></div>
      {subValue !== undefined && (
        <div className="kpi-sub">
          <span className="kpi-sub-label">{subLabel}&nbsp;</span>
          <AnimNum value={subValue ?? 0} />
        </div>
      )}
      {note && <div className="kpi-note">{note}</div>}
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
        <span style={{color:"var(--accent)"}}>■ Daily</span>
        <span style={{color:"var(--accent-dark)"}}>— MTD</span>
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
            <Bar yAxisId="left" dataKey="daily_revenue" name="Daily revenue" fill="var(--accent)" radius={[2,2,0,0]} maxBarSize={16}/>
            <Line yAxisId="right" type="monotone" dataKey="mtd_cumulative" name="MTD cumulative" stroke="var(--accent-dark)" strokeWidth={2} dot={false}/>
            <Line yAxisId="right" type="monotone" dataKey="goal_mtd" name="Goal MTD" stroke="var(--accent-goal)" strokeWidth={1.5} strokeDasharray="5 3" dot={false}/>
          </ComposedChart>
        </ResponsiveContainer>
        <div style={{display:"flex",alignItems:"center",writingMode:"vertical-rl",fontSize:9,color:"var(--text-muted)",padding:"0 2px",whiteSpace:"nowrap"}}>MTD / Goal ($)</div>
      </div>
    </div>
  );
}

// UPDATED: consumes new API shape — { categories: [...], breakdown: [...], total }
// Primary donut uses item_category sales mix
function CategoryChart({ categories, total }) {
  if (!categories?.length) return <div className="chart-empty">No category data</div>;
  return (
    <div className="chart-card category-card">
      <div className="chart-title">Sales mix by item category</div>
      <ResponsiveContainer width="100%" height={190}>
        <PieChart>
          <Pie data={categories} cx="50%" cy="50%" innerRadius={52} outerRadius={82}
               dataKey="revenue" nameKey="category" paddingAngle={2}>
            {categories.map((entry, i) => (
              <Cell key={entry.category} fill={DONUT_COLORS[i % DONUT_COLORS.length]}/>
            ))}
          </Pie>
          <Tooltip formatter={(v, n, p) => [fmt(v, true), p.payload.category]}/>
        </PieChart>
      </ResponsiveContainer>
      <div className="cat-legend">
        {categories.map((d, i) => (
          <div key={d.category} className="cat-legend-item">
            <span className="cat-dot" style={{background:DONUT_COLORS[i%DONUT_COLORS.length]}}/>
            <span className="cat-name">{d.category}</span>
            <span className="cat-pct">{d.percentage}%</span>
          </div>
        ))}
      </div>
      {total > 0 && (
        <div style={{textAlign:"center",fontSize:10,color:"var(--text-muted)",marginTop:6}}>
          Total: {fmt(total, true)}
        </div>
      )}
    </div>
  );
}

function WeekRow({ week, daily, isOpen, onToggle }) {
  const dayRows = isOpen
    ? daily.filter(d => d.date >= week.start && d.date <= week.end)
    : [];
  const wowKnown = week.wow !== null && week.wow !== undefined;
  const wowPos   = wowKnown && week.wow >= 0;

  return (
    <>
      <tr className="week-row" onClick={onToggle}>
        <td className="week-row-label">
          <span className={`week-chevron${isOpen ? " open" : ""}`}>
            <ChevronDownIcon size={13} />
          </span>
          <strong>{week.week}</strong>
          {week.label && <span className="week-range">({week.label})</span>}
        </td>
        <td>{fmt(week.revenue)}</td>
        <td className={!wowKnown ? "" : wowPos ? "wow-pos" : "wow-neg"}>
          {!wowKnown ? "—" : (
            <span className="wow-cell">
              {wowPos ? <ArrowUpIcon size={12} /> : <ArrowDownIcon size={12} />}
              {Math.abs(week.wow).toFixed(2)}%
            </span>
          )}
        </td>
      </tr>
      {dayRows.map(d => (
        <tr key={d.date} className="day-subrow">
          <td className="day-subrow-label">{fmtDate(d.date)}</td>
          <td>{fmt(d.daily_revenue)}</td>
          <td />
        </tr>
      ))}
    </>
  );
}

function WeeklyTable({ weekly, daily = [] }) {
  const { weeks=[], full_month_pace=0 } = weekly || {};
  const [openWeek, setOpenWeek] = useState(null);

  return (
    <div className="weekly-card">
      <table className="weekly-table">
        <thead>
          <tr>
            <th className="weekly-th-title">
              <span className="weekly-th-title-inner">
                <CalendarIcon size={14} />
                Weekly Revenue Summary
              </span>
            </th>
            <th>Revenue</th>
            <th>WoW</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map(w => (
            <WeekRow
              key={w.week}
              week={w}
              daily={daily}
              isOpen={openWeek === w.week}
              onToggle={() => setOpenWeek(openWeek === w.week ? null : w.week)}
            />
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

export default function Revenue({ apiBase, month, center, onData, aiInsights }) {
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [summary,  setSummary]  = useState(null);
  const [daily,    setDaily]    = useState([]);
  // UPDATED: store full categories response object (has .categories, .breakdown, .total)
  const [catsData, setCatsData] = useState(null);
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
      setSummary(s);
      setDaily(d.data || []);
      // New API returns { categories, breakdown, total } — store the whole object
      setCatsData(c);
      setWeekly(w);
      setLoaded(true);
      onData?.({ summary: s, daily: d.data || [], categories: c, weekly: w }, false);
    } catch(e) {
      setError(e.message || "Failed to load data");
      onData?.({}, false);
    } finally {
      setLoading(false);
    }
  }, [apiBase, month, center]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="dash-content">
      {error && <div className="error-bar"><AlertTriangleIcon size={14} />{error}</div>}

      {/* ── KPI Row ── */}
      {loading ? (
        <div className="loading-row">
          {[100,90,80,70,60,55,50].map((w,i)=>(
            <div key={i} className="kpi-card">
              <Skeleton h="10px" w="60%" mb="8px"/><Skeleton h="24px" w={`${w}%`}/>
            </div>
          ))}
        </div>
      ) : loaded ? (
        <>
          {summary?.goal > 0 && <GoalBar mtd={summary.mtd_revenue} goal={summary.goal}/>}
          {/* Row 1: Revenue KPIs */}
          <div className="kpi-row">
            <KpiCard icon={<DollarIcon size={17} />}     label="MTD Revenue"  value={summary?.mtd_revenue}  subLabel="Yest:" subValue={summary?.yesterday_revenue} highlight/>
            <KpiCard icon={<TrendingUpIcon size={17} />} label="Projected"    value={summary?.projected}/>
            <KpiCard icon={<CalendarIcon size={17} />}   label="Rev / Day"    value={summary?.rev_per_day}/>
            <KpiCard icon={<ClockIcon size={17} />}      label="Rev / Hour"   value={summary?.rev_per_hour}/>
            <KpiCard icon={<StarIcon size={17} />}       label="30-Day ADV"   value={summary?.adv}/>
          </div>
          {/* Row 2: ASP + Cash sales — large illustrative art on the right,
              matching the reference design (distinct from the small
              circular badges used in the row above) */}
          <div className="stat-row">
            <div className="stat-card">
              <div className="stat-card-body">
                <div className="stat-card-label">Avg. Selling Price (ASP)</div>
                <div className="stat-card-value"><AnimNum value={summary?.asp ?? 0} /></div>
                <div className="stat-card-note">{summary?.invoice_count ?? 0} invoices</div>
              </div>
              <div className="stat-card-art"><img src={dropperAspImg} alt="ASP" style={{ width: 100, height: 100, objectFit: "contain" }} /></div>
            </div>

            <div className="stat-card">
              <div className="stat-card-body">
                <div className="stat-card-label">Cash Sales MTD</div>
                <div className="stat-card-value"><AnimNum value={summary?.cash_sales ?? 0} /></div>
                <div className="stat-card-note">Payment Type: Cash</div>
              </div>
              <div className="stat-card-art"><img src={cashStackImg} alt="Cash" style={{ width: 100, height: 100, objectFit: "contain" }} /></div>
            </div>

            <div className="stat-card stat-card--column">
              <div className="stat-card-top-row">
                <div className="stat-card-body">
                  <div className="stat-card-label">Cash vs Total</div>
                  <div className="stat-card-value">
                    {summary?.mtd_revenue > 0
                      ? ((summary.cash_sales / summary.mtd_revenue) * 100).toFixed(1) + "%"
                      : "—"}
                  </div>
                  <div className="stat-card-note">Cash sales as % of total revenue</div>
                </div>
                <div className="stat-card-art">
                  <CashPieArt
                    size={100}
                    pct={summary?.mtd_revenue > 0 ? (summary.cash_sales / summary.mtd_revenue) * 100 : 0}
                  />
                </div>
              </div>
              <div className="stat-progress-track">
                <div className="stat-progress-fill" style={{
                  width: summary?.mtd_revenue > 0
                    ? `${Math.min((summary.cash_sales/summary.mtd_revenue)*100,100)}%`
                    : "0%",
                }}/>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* ── AI Insights ── */}
      {loaded && aiInsights && aiInsights()}

      {/* ── Charts Row ── */}
      {loading ? (
        <div className="loading-chart-row">
          <div className="chart-card"><Skeleton h="260px"/></div>
          <div className="chart-card"><Skeleton h="260px"/></div>
        </div>
      ) : loaded ? (
        <div className="charts-row">
          <RevenueChart data={daily}/>
          {/* UPDATED: pass categories array + total from new response shape */}
          <CategoryChart
            categories={catsData?.categories || []}
            total={catsData?.total || 0}
          />
        </div>
      ) : null}

      {/* ── Weekly Table ── */}
      {loading ? (
        <div className="weekly-card" style={{padding:16}}><Skeleton h="140px"/></div>
      ) : loaded ? (
        <WeeklyTable weekly={weekly} daily={daily}/>
      ) : null}
    </div>
  );
}
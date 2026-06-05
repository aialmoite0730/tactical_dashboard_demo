import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";

const MEDAL = ["🥇","🥈","🥉"];
const BAR_COLORS = ["#3d2b1f","#7a5c3e","#a0845c","#c4a882","#e8d5b0"];

function fmt(n, compact=false) {
  if (n === null || n === undefined) return "$—";
  if (compact && n >= 1_000_000) return `$${(n/1_000_000).toFixed(2)}M`;
  if (compact && n >= 1_000)     return `$${(n/1_000).toFixed(0)}K`;
  return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n);
}

function Skeleton({ h="18px", w="100%", mb="0" }) {
  return <div style={{height:h,width:w,borderRadius:4,background:"var(--skeleton)",marginBottom:mb,animation:"pulse 1.4s ease infinite"}}/>;
}

function MiniBar({ value, max }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{background:"var(--grid)",borderRadius:3,height:6,width:"100%",marginTop:3}}>
      <div style={{background:"var(--accent-bar)",borderRadius:3,height:6,width:`${pct}%`,transition:"width 0.6s ease"}}/>
    </div>
  );
}

function StaffLeaderboard({ data }) {
  if (!data?.length) return <div className="chart-empty">No staff data</div>;
  const maxRev = data[0]?.revenue || 0;

  return (
    <div className="chart-card" style={{flex:1}}>
      <div className="chart-title">Staff revenue ranking — MTD</div>
      <div className="leaderboard-list">
        {data.map((s, i) => (
          <div key={s.staff} className={`lb-row${i < 3 ? " lb-row--top" : ""}`}>
            <div className="lb-rank">
              {i < 3 ? MEDAL[i] : <span className="lb-num">{s.rank}</span>}
            </div>
            <div className="lb-info">
              <div className="lb-name">{s.staff}</div>
              <MiniBar value={s.revenue} max={maxRev}/>
            </div>
            <div className="lb-stats">
              <div className="lb-rev">{fmt(s.revenue, true)}</div>
              <div className="lb-meta">{s.share}% · {s.invoice_count} inv · {fmt(s.avg_ticket,true)}/avg</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopStaffChart({ data }) {
  if (!data?.length) return null;
  const top5 = data.slice(0, 8);
  return (
    <div className="chart-card">
      <div className="chart-title">Revenue by staff — top 8</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={top5} layout="vertical" margin={{top:4,right:60,left:0,bottom:0}}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" horizontal={false}/>
          <XAxis type="number" tickFormatter={v=>`$${(v/1000).toFixed(0)}K`}
                 tick={{fontSize:9,fill:"var(--text-muted)"}} tickLine={false} axisLine={false}/>
          <YAxis type="category" dataKey="staff" width={90}
                 tick={{fontSize:10,fill:"var(--text-muted)"}} tickLine={false} axisLine={false}/>
          <Tooltip formatter={v=>[fmt(v,true),"Revenue"]}/>
          <Bar dataKey="revenue" radius={[0,3,3,0]} maxBarSize={14}>
            {top5.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]}/>)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ServicerTable({ data }) {
  if (!data?.length) return <div className="chart-empty">No servicer data</div>;
  return (
    <div className="weekly-card">
      <div style={{padding:"10px 16px 6px",fontSize:11,color:"var(--text-muted)",fontStyle:"italic"}}>Revenue by servicer</div>
      <table className="weekly-table">
        <thead><tr><th>Servicer</th><th>Revenue</th><th>Invoices</th><th>Share</th></tr></thead>
        <tbody>
          {data.map(r => (
            <tr key={r.servicer}>
              <td>{r.servicer}</td>
              <td style={{textAlign:"right"}}>{fmt(r.revenue,true)}</td>
              <td style={{textAlign:"right"}}>{r.invoices}</td>
              <td style={{textAlign:"right"}}>{r.share}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReferralTable({ data }) {
  if (!data?.length) return <div className="chart-empty">No referral data</div>;
  const max = data[0]?.count || 0;
  return (
    <div className="chart-card">
      <div className="chart-title">Top referral sources</div>
      {data.map(r => (
        <div key={r.source} style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2}}>
            <span style={{color:"var(--text)"}}>{r.source}</span>
            <span style={{color:"var(--text-muted)"}}>{r.count} visits · {fmt(r.revenue,true)}</span>
          </div>
          <div style={{background:"var(--grid)",borderRadius:3,height:5}}>
            <div style={{background:"var(--accent-line)",borderRadius:3,height:5,
                         width:`${max>0?(r.count/max)*100:0}%`,transition:"width 0.5s ease"}}/>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Leaderboard({ apiBase, month, center }) {
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [staff,     setStaff]     = useState([]);
  const [servicers, setServicers] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [loaded,    setLoaded]    = useState(false);

  const post = useCallback((action, extra={}) =>
    fetch(`${apiBase}/api/leaderboard`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action, month, center, ...extra }),
    }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
  , [apiBase, month, center]);

  const load = useCallback(async () => {
    setLoading(true); setError(""); setLoaded(false);
    try {
      const [s, sv, ref] = await Promise.all([
        post("staff"),
        post("service_types"),
        post("referrals"),
      ]);
      if (s.error) throw new Error(s.error);
      setStaff(s.data||[]);
      setServicers(sv.data||[]);
      setReferrals(ref.data||[]);
      setLoaded(true);
    } catch(e) {
      setError(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [post]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="dash-content">
      {error && <div className="error-bar">⚠ {error}</div>}

      {loading ? (
        <>
          <div className="loading-chart-row">
            <div className="chart-card"><Skeleton h="300px"/></div>
            <div className="chart-card"><Skeleton h="300px"/></div>
          </div>
          <div className="weekly-card" style={{padding:16,marginTop:0}}><Skeleton h="120px"/></div>
        </>
      ) : loaded ? (
        <>
          <div className="charts-row" style={{gridTemplateColumns:"1fr 340px"}}>
            <StaffLeaderboard data={staff}/>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <TopStaffChart data={staff}/>
              <ReferralTable data={referrals}/>
            </div>
          </div>
          <ServicerTable data={servicers}/>
        </>
      ) : null}
    </div>
  );
}

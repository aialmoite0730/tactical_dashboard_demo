import { useState, useEffect, useCallback } from "react";
import Revenue     from "./components/Revenue";
import Leaderboard from "./components/Leaderboard";

// ─── Config ────────────────────────────────────────────────
const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";
const MONTHS   = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const YEARS    = [2024, 2025, 2026];
const TABS = [
  { id: "revenue",     label: "📈 Revenue",     icon: "📈" },
  { id: "leaderboard", label: "🏆 Leaderboard",  icon: "🏆" },
];

function monthStr(monthName, year) {
  const m = String(MONTHS.indexOf(monthName)+1).padStart(2,"0");
  return `${year}-${m}`;
}

export default function App() {
  const now = new Date();
  const [tab,           setTab]           = useState("revenue");
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[now.getMonth()]);
  const [selectedYear,  setSelectedYear]  = useState(now.getFullYear());
  
  // staged values — only committed on Apply
  const [stagedMonth,   setStagedMonth]   = useState(MONTHS[now.getMonth()]);
  const [stagedYear,    setStagedYear]    = useState(now.getFullYear());
  const [center,        setCenter]        = useState("All");
  const [stagedCenter,  setStagedCenter]  = useState("All");
  const [centers,       setCenters]       = useState([]);
  const [centersLoaded, setCentersLoaded] = useState(false);
  
  // trigger re-load in child by bumping this key
  const [refreshKey,    setRefreshKey]    = useState(0);
  const month = monthStr(selectedMonth, selectedYear);

  // Load center list once
  useEffect(() => {
    fetch(`${API_BASE}/api/centers`)
      .then(r => r.json())
      .then(d => { setCenters(d.centers || []); setCentersLoaded(true); })
      .catch(() => setCentersLoaded(true));
  }, []);

  const handleApply = () => {
    setSelectedMonth(stagedMonth);
    setSelectedYear(stagedYear);
    setCenter(stagedCenter);
    setRefreshKey(k => k + 1);
  };

  const handleRefresh = () => setRefreshKey(k => k + 1);

  return (
    <>
      <style>{`
        :root {
          --bg:          #f5f0e8;
          --surface:     #faf7f2;
          --surface-2:   #ffffff;
          --border:      #e2d9cc;
          --text:        #1a1410;
          --text-muted:  #8a7a6a;
          --accent-bar:  #7a5c3e;
          --accent-line: #3d2b1f;
          --accent-goal: #b89a6a;
          --grid:        #ede6da;
          --wow-pos:     #2d6a4f;
          --wow-neg:     #9b1c1c;
          --skeleton:    #e8e0d4;
          --radius:      10px;
          --shadow:      0 1px 4px rgba(0,0,0,0.07);
        }
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        html, body {
          height:100%; font-family:"Georgia","Times New Roman",serif;
          background:var(--bg); color:var(--text); font-size:14px;
          -webkit-font-smoothing:antialiased;
        }
        /* ── Header ── */
        .header {
          display:flex; align-items:center; justify-content:space-between;
          padding:0 24px; height:52px; background:var(--surface-2);
          border-bottom:1px solid var(--border); position:sticky; top:0; z-index:50;
          box-shadow:var(--shadow);
        }
        .header-brand { font-size:13px; font-weight:700; letter-spacing:0.04em; }
        .header-right  { display:flex; align-items:center; gap:8px; }
        .hdr-select {
          font-family:inherit; font-size:12px; padding:5px 10px;
          border:1px solid var(--border); border-radius:6px;
          background:var(--surface); color:var(--text); cursor:pointer;
        }
        .hdr-select:focus { outline:none; border-color:#a0845c; }
        .apply-btn {
          font-family:inherit; font-size:12px; font-weight:700; padding:6px 16px;
          border:none; border-radius:6px; background:var(--accent-bar); color:#fff;
          cursor:pointer; letter-spacing:0.03em; transition:opacity 0.15s;
        }
        .apply-btn:hover { opacity:0.85; }
        .refresh-btn {
          font-size:14px; background:none; border:1px solid var(--border);
          border-radius:6px; padding:4px 10px; cursor:pointer; color:var(--text-muted);
          transition:color 0.15s;
        }
        .refresh-btn:hover { color:var(--text); }
        .hdr-divider { width:1px; height:24px; background:var(--border); margin:0 4px; }

        /* ── Tab bar ── */
        .tabbar {
          display:flex; align-items:center; gap:2px;
          padding:0 24px; background:var(--surface-2);
          border-bottom:1px solid var(--border);
          position:sticky; top:52px; z-index:40;
        }
        .tab-btn {
          font-family:inherit; font-size:12px; padding:10px 18px;
          border:none; background:none; color:var(--text-muted);
          cursor:pointer; border-bottom:2px solid transparent;
          transition:all 0.15s; letter-spacing:0.02em; white-space:nowrap;
        }
        .tab-btn:hover { color:var(--text); }
        .tab-btn.active { color:var(--accent-line); border-bottom-color:var(--accent-line); font-weight:700; }

        /* ── Context bar ── */
        .context-bar {
          display:flex; align-items:center; gap:8px; padding:7px 24px;
          background:var(--surface); border-bottom:1px solid var(--border);
          font-size:11px; color:var(--text-muted);
        }
        .ctx-chip {
          background:var(--surface-2); border:1px solid var(--border);
          border-radius:20px; padding:2px 10px; font-size:11px; color:var(--text);
        }

        /* ── Dashboard layout ── */
        .dash-content { padding:18px 24px; display:flex; flex-direction:column; gap:14px; }

        /* ── KPI Row ── */
        .kpi-row { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; }
        .kpi-card {
          background:var(--surface-2); border:1px solid var(--border);
          border-radius:var(--radius); padding:12px 16px; box-shadow:var(--shadow);
          transition:box-shadow 0.15s;
        }
        .kpi-card--highlight { border-color:var(--accent-bar); }
        .kpi-label { font-size:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.07em; margin-bottom:5px; }
        .kpi-value { font-size:20px; font-weight:700; color:var(--text); line-height:1; letter-spacing:-0.01em; }
        .kpi-sub   { margin-top:5px; font-size:10px; color:var(--text-muted); display:flex; gap:4px; align-items:center; }

        /* ── Goal bar ── */
        .goal-bar-wrap { background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius); padding:12px 16px; box-shadow:var(--shadow); }
        .goal-bar-header { display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); margin-bottom:8px; }
        .goal-bar-track { background:var(--grid); border-radius:4px; height:8px; }
        .goal-bar-fill  { background:var(--accent-bar); border-radius:4px; height:8px; transition:width 0.8s ease; }

        /* ── Charts ── */
        .charts-row { display:grid; grid-template-columns:1fr 360px; gap:12px; }
        .loading-chart-row { display:grid; grid-template-columns:1fr 360px; gap:12px; }
        .loading-row  { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; }
        .chart-card {
          background:var(--surface-2); border:1px solid var(--border);
          border-radius:var(--radius); padding:14px 16px; box-shadow:var(--shadow);
        }
        .chart-title { font-size:11px; color:var(--text-muted); font-style:italic; margin-bottom:8px; }
        .chart-empty { color:var(--text-muted); font-size:12px; padding:40px; text-align:center; }
        .chart-legend-row { display:flex; gap:14px; margin-bottom:6px; font-size:10px; color:var(--text-muted); } 

        /* ── Category chart ── */
        .category-card { display:flex; flex-direction:column; }
        .cat-legend { display:grid; grid-template-columns:1fr 1fr; gap:3px 10px; margin-top:6px; }
        .cat-legend-item { display:flex; align-items:center; gap:5px; font-size:10px; color:var(--text-muted); }
        .cat-dot  { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .cat-name { flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .cat-pct  { font-weight:700; color:var(--text); }

        /* ── Weekly table ── */
        .weekly-card { background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; box-shadow:var(--shadow); }
        .weekly-table { width:100%; border-collapse:collapse; font-size:13px; }
        .weekly-table th { padding:9px 20px; text-align:left; font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; border-bottom:1px solid var(--border); }
        .weekly-table th:not(:first-child), .weekly-table td:not(:first-child) { text-align:right; }
        .weekly-table td { padding:9px 20px; border-bottom:1px solid var(--grid); }
        .weekly-table tr:last-child td { border-bottom:none; }
        .wow-pos { color:var(--wow-pos); font-weight:700; }
        .wow-neg { color:var(--wow-neg); font-weight:700; }
        .pace-row td { font-weight:700; background:var(--bg); }

        /* ── Leaderboard ── */
        .leaderboard-list { display:flex; flex-direction:column; gap:4px; max-height:420px; overflow-y:auto; }
        .lb-row {
          display:flex; align-items:center; gap:10px;
          padding:7px 10px; border-radius:6px; transition:background 0.1s;
        }
        .lb-row:hover { background:var(--bg); }
        .lb-row--top  { background:linear-gradient(90deg, rgba(196,168,130,0.08), transparent); }
        .lb-rank      { font-size:18px; width:28px; text-align:center; flex-shrink:0; }
        .lb-num       { font-size:12px; color:var(--text-muted); font-weight:700; }
        .lb-info      { flex:1; min-width:0; }
        .lb-name      { font-size:12px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .lb-stats     { text-align:right; flex-shrink:0; }
        .lb-rev       { font-size:14px; font-weight:700; }
        .lb-meta      { font-size:10px; color:var(--text-muted); }

        /* ── Tooltip ── */
        .chart-tooltip {
          background:var(--surface-2); border:1px solid var(--border);
          border-radius:6px; padding:8px 12px; font-size:11px;
          box-shadow:0 4px 12px rgba(0,0,0,0.1);
        } 
        .tooltip-date { font-weight:700; margin-bottom:3px; }
        .tooltip-row  { display:flex; justify-content:space-between; gap:12px; }

        /* ── Error ── */
        .error-bar {
          background:#fef2f2; border:1px solid #fca5a5; color:#991b1b;
          padding:10px 20px; font-size:12px; border-radius:8px;
        }

        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }

        /* ── Responsive ── */
        @media (max-width:1100px) { .charts-row,.loading-chart-row { grid-template-columns:1fr; } }
        @media (max-width:800px)  {
          .kpi-row,.loading-row { grid-template-columns:repeat(2,1fr); }
          .dash-content { padding:12px 14px; }
          .header { padding:0 14px; }
          .tabbar { padding:0 14px; overflow-x:auto; }
          .context-bar { padding:6px 14px; }
        }
        @media (max-width:500px)  { .kpi-row,.loading-row { grid-template-columns:1fr; } }
      `}</style>

      {/* ── Header ── */}
      <header className="header">
        <div className="header-brand">Tactical Dashboard</div>
        <div className="header-right">
          {/* Center filter */}
          <select className="hdr-select" value={stagedCenter}
                  onChange={e => setStagedCenter(e.target.value)}
                  style={{maxWidth:160}}>
            <option value="All">All Centers</option>
            {centers.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="hdr-divider"/>
          {/* Month/Year pickers */}
          <select className="hdr-select" value={stagedYear}
                  onChange={e => setStagedYear(Number(e.target.value))}>
            {YEARS.map(y => <option key={y}>{y}</option>)}
          </select>
          <select className="hdr-select" value={stagedMonth}
                  onChange={e => setStagedMonth(e.target.value)}>
            {MONTHS.map(m => <option key={m}>{m}</option>)}
          </select>
          <button className="apply-btn" onClick={handleApply}>▶ Apply</button>
          <button className="refresh-btn" onClick={handleRefresh} title="Refresh">↻</button>
        </div>
      </header>

      {/* ── Tab bar ── */}
      <nav className="tabbar">
        {TABS.map(t => (
          <button key={t.id} className={`tab-btn${tab===t.id ? " active" : ""}`}
                  onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {/* ── Context strip ── */}
      <div className="context-bar">
        <span>Viewing:</span>
        <span className="ctx-chip">{center === "All" ? "All Centers" : center}</span>
        <span className="ctx-chip">{selectedMonth} {selectedYear}</span>
      </div>

      {/* ── Dashboard panels ── */}
      {tab === "revenue"      && <Revenue     key={`rev-${refreshKey}`} apiBase={API_BASE} month={month} center={center} />}
      {tab === "leaderboard"  && <Leaderboard key={`lb-${refreshKey}`}  apiBase={API_BASE} month={month} center={center} />}
    </>
  );
}
import { useState, useEffect, useCallback } from "react";
import "./App.css";
import Revenue      from "./components/Revenue";
import Leaderboard  from "./components/Leaderboard";
import Appointments from "./components/Appointments";
import Utilization  from "./components/Utilization";
import AiInsights   from "./components/AiInsights";

// ─── Config ────────────────────────────────────────────────
const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";
const MONTHS   = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const YEARS    = [2024, 2025, 2026];
const TABS = [
  { id: "revenue",      label: "📈 Revenue"      },
  { id: "leaderboard",  label: "🏆 Leaderboard"  },
  { id: "appointments", label: "📅 Appointments" },
  { id: "utilization",  label: "⏱ Utilization"  },
];

function monthStr(monthName, year) {
  const m = String(MONTHS.indexOf(monthName)+1).padStart(2,"0");
  return `${year}-${m}`;
}

export default function App() {
  const now = new Date();
  
  // Core Filters
  const [tab,           setTab]           = useState("revenue");
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[now.getMonth()]);
  const [selectedYear,  setSelectedYear]  = useState(now.getFullYear());
  const [center,        setCenter]        = useState("All");

  // Center Lists (Separated for Revenue vs Appointments)
  const [centers,       setCenters]       = useState([]);
  const [apptCenters,   setApptCenters]   = useState([]);
  const [centersLoaded, setCentersLoaded] = useState(false);

  // Refresh trigger
  const [refreshKey,    setRefreshKey]    = useState(0);

  // Derived values — must be before any hook that references them
  const month         = monthStr(selectedMonth, selectedYear);
  const activeCenters = tab === "appointments" ? apptCenters : centers;

  // AI Insights — panels report their fetched data + loading state upward
  const [panelData,    setPanelData]    = useState({});
  const [panelLoading, setPanelLoading] = useState(true);

  const handlePanelData = useCallback((d, l) => {
    setPanelData(d);
    setPanelLoading(l);
  }, []);

  // Render-prop: called fresh each render so always reads current state.
  const renderAiInsights = useCallback((tabId) => (
    <AiInsights
      tab={tabId}
      data={panelData}
      loading={panelLoading}
      month={month}
      center={center}
    />
  ), [month, center, panelData, panelLoading]);
  
  // 1. Load BOTH center lists once on mount
  useEffect(() => {
    let loadedCount = 0;
    const checkDone = () => {
      loadedCount++;
      if (loadedCount === 2) setCentersLoaded(true);
    };

    fetch(`${API_BASE}/api/centers`)
      .then(r => r.json())
      .then(d => { setCenters(d.centers || []); checkDone(); })
      .catch(() => checkDone());

    fetch(`${API_BASE}/api/appointment_centers`)
      .then(r => r.json())
      .then(d => { setApptCenters(d.centers || []); checkDone(); })
      .catch(() => checkDone());
  }, []);

  // 2. Auto-reset center to "All" if switching tabs makes the current center invalid
  useEffect(() => {
    if (!centersLoaded) return;
    if (center !== "All" && !activeCenters.includes(center)) {
      setCenter("All");
      setRefreshKey(k => k + 1);
    }
  }, [tab, activeCenters, center, centersLoaded]);

  // 3. Clear stale panel data whenever the active view changes
  useEffect(() => {
    setPanelData({});
    setPanelLoading(true);
  }, [tab, month, center]);

  return (
    <>

      {/* ── Header ── */}
      <header className="header">
        <div className="header-brand">Tactical Dashboard</div>
        <div className="header-right">
          <select className="hdr-select" value={center}
                  onChange={e => { setCenter(e.target.value); setRefreshKey(k => k + 1); }}
                  style={{maxWidth:160}}>
            <option value="All">All Centers</option>
            {activeCenters.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="hdr-divider"/>
          <select className="hdr-select" value={selectedYear}
                  onChange={e => { setSelectedYear(Number(e.target.value)); setRefreshKey(k => k + 1); }}>
            {YEARS.map(y => <option key={y}>{y}</option>)}
          </select>
          <select className="hdr-select" value={selectedMonth}
                  onChange={e => { setSelectedMonth(e.target.value); setRefreshKey(k => k + 1); }}>
            {MONTHS.map(m => <option key={m}>{m}</option>)}
          </select>
          {panelLoading && (
            <span className="hdr-loading">
              <span className="ai-pulse" style={{fontSize:8}}>●</span>
              <span className="ai-pulse" style={{fontSize:8,animationDelay:"0.2s"}}>●</span>
              <span className="ai-pulse" style={{fontSize:8,animationDelay:"0.4s"}}>●</span>
              Loading data…
            </span>
          )}
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

      {/* ── Dashboard panels ── onData bubbles data up; aiInsights is a render-prop ── */}
      {tab === "revenue"      && <Revenue      key={`rev-${refreshKey}`}  apiBase={API_BASE} month={month} center={center} onData={handlePanelData} aiInsights={() => renderAiInsights("revenue")}      />}
      {tab === "leaderboard"  && <Leaderboard  key={`lb-${refreshKey}`}   apiBase={API_BASE} month={month} center={center} onData={handlePanelData} aiInsights={() => renderAiInsights("leaderboard")}  />}
      {tab === "appointments" && <Appointments key={`appt-${refreshKey}`} apiBase={API_BASE} month={month} center={center} onData={handlePanelData} aiInsights={() => renderAiInsights("appointments")} />}
      {tab === "utilization"  && <Utilization  key={`util-${refreshKey}`} apiBase={API_BASE} month={month} center={center} onData={handlePanelData} aiInsights={() => renderAiInsights("utilization")}  />}
    </>
  );
}
import { useState, useEffect, useCallback } from "react";
import "./App.css";
import Revenue      from "./components/Revenue";
import Leaderboard  from "./components/Leaderboard";
import Appointments from "./components/Appointments";
import Utilization  from "./components/Utilization";
import AiInsights   from "./components/AiInsights";
import {
  ChartBarIcon, TrophyIcon, AppointmentsIcon, ClockIcon,
  PinIcon, CalendarIcon, HeadsetIcon, ChevronDownIcon, InfoIcon,
} from "./Icons";
// import Login from "./components/Login"; // disabled — uncomment with SSO gate

// ─── Config ───────────────────────────────────────────────────────────────────
const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";
const MONTHS   = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];
const YEARS    = [2024, 2025, 2026];
const TABS = [
  { id: "revenue",      label: "Revenue",      icon: ChartBarIcon },
  { id: "leaderboard",  label: "Leaderboard",  icon: TrophyIcon },
  { id: "appointments", label: "Appointments", icon: AppointmentsIcon },
  { id: "utilization",  label: "Utilization",  icon: ClockIcon },
];

// Tab → page title + subtitle shown in the topbar
const TAB_META = {
  revenue:      { title: "Revenue Overview",      sub: "Track your clinic's financial performance and key revenue metrics." },
  leaderboard:  { title: "Staff Leaderboard",     sub: "Staff revenue rankings, servicer breakdown, and referral sources." },
  appointments: { title: "Appointments",          sub: "Appointment volume, status breakdown, and rebook rates." },
  utilization:  { title: "Provider Utilization",  sub: "Utilization rates and revenue per hour by provider and role." },
};

function monthStr(monthName, year) {
  const m = String(MONTHS.indexOf(monthName) + 1).padStart(2, "0");
  return `${year}-${m}`;
}

// ── User initials (for sidebar avatar) ───────────────────────────────────────
function initials(user) {
  if (!user) return "?";
  if (user.name) return user.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return (user.email || "?")[0].toUpperCase();
}

// ── Restore session from localStorage ────────────────────────────────────────
function restoreSession() {
  try {
    const raw = localStorage.getItem("auth_user");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function App() {
  const now = new Date();

  // ── Auth state ─────────────────────────────────────────────────────────────
  const [user, setUser] = useState(() => restoreSession());

  const handleLogin = useCallback((u) => {
    setUser(u);
    localStorage.setItem("auth_user", JSON.stringify(u));
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("auth_user");
    localStorage.removeItem("auth_token");
  }, []);

  // ── Filter state ───────────────────────────────────────────────────────────
  const [tab,           setTab]           = useState("revenue");
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[now.getMonth()]);
  const [selectedYear,  setSelectedYear]  = useState(now.getFullYear());
  const [center,        setCenter]        = useState("All");

  const [centers,       setCenters]       = useState([]);
  const [apptCenters,   setApptCenters]   = useState([]);
  const [centersLoaded, setCentersLoaded] = useState(false);
  const [refreshKey,    setRefreshKey]    = useState(0);

  const month         = monthStr(selectedMonth, selectedYear);
  const activeCenters = tab === "appointments" ? apptCenters : centers;

  // ── AI Insights bridge ─────────────────────────────────────────────────────
  const [panelData,    setPanelData]    = useState({});
  const [panelLoading, setPanelLoading] = useState(true);

  const handlePanelData = useCallback((d, l) => {
    setPanelData(d);
    setPanelLoading(l);
  }, []);

  const renderAiInsights = useCallback((tabId) => (
    <AiInsights
      tab={tabId}
      data={panelData}
      loading={panelLoading}
      month={month}
      center={center}
    />
  ), [month, center, panelData, panelLoading]);

  // ── Load centers ───────────────────────────────────────────────────────────
  useEffect(() => {
    let done = 0;
    const check = () => { if (++done === 2) setCentersLoaded(true); };
    fetch(`${API_BASE}/api/centers`)
      .then(r => r.json()).then(d => { setCenters(d.centers || []); check(); })
      .catch(check);
    fetch(`${API_BASE}/api/appointment_centers`)
      .then(r => r.json()).then(d => { setApptCenters(d.centers || []); check(); })
      .catch(check);
  }, []);

  // ── Auto-reset center ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!centersLoaded) return;
    if (center !== "All" && !activeCenters.includes(center)) {
      setCenter("All");
      setRefreshKey(k => k + 1);
    }
  }, [tab, activeCenters, center, centersLoaded]);

  // ── Clear stale panel data on filter change ────────────────────────────────
  useEffect(() => {
    setPanelData({});
    setPanelLoading(true);
  }, [tab, month, center]);

  // ── Login disabled — uncomment to re-enable SSO gate ─────────────────────
  // if (!user) return <Login onLogin={handleLogin} />;

  const meta = TAB_META[tab];
  const dataAsOf = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="app-shell">

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-name">TACTICAL</div>
          <div className="sidebar-brand-sub">Dashboard</div>
        </div>

        <nav className="sidebar-nav">
          {TABS.map(t => {
            const TabIcon = t.icon;
            return (
              <button
                key={t.id}
                className={`sidebar-btn${tab === t.id ? " active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                <span className="sidebar-btn-icon"><TabIcon size={16} /></span>
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Profile + help — hidden when login is disabled */}
        {user && (
          <div className="sidebar-bottom">
            <div className="sidebar-profile-card">
              <div className="sidebar-avatar">
                {user.picture
                  ? <img src={user.picture} alt={user.name || user.email} />
                  : initials(user)
                }
              </div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{user.name || "User"}</div>
                <div className="sidebar-user-email">{user.email}</div>
              </div>
              <button
                className="sidebar-logout-btn"
                onClick={handleLogout}
                title="Sign out"
              ><ChevronDownIcon size={14} /></button>
            </div>

            <div className="sidebar-help-card" title="Contact support">
              <div className="sidebar-help-icon"><HeadsetIcon size={15} /></div>
              <div>
                <div className="sidebar-help-title">Need Help?</div>
                <div className="sidebar-help-sub">Contact Support</div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* ── Main content ── */}
      <div className="main-area">

        {/* ── Topbar ── */}
        <header className="topbar">
          <div className="topbar-title">
            <h1>{meta.title}</h1>
            <p>{meta.sub}</p>
          </div>

          <div className="topbar-right">
            <div className="topbar-controls">
              {/* Center picker */}
              <div className="topbar-select-wrap">
                <span className="topbar-select-icon"><PinIcon size={14} /></span>
                <select
                  className="hdr-select"
                  value={center}
                  onChange={e => { setCenter(e.target.value); setRefreshKey(k => k + 1); }}
                  style={{ maxWidth: 140 }}
                >
                  <option value="All">All Centers</option>
                  {activeCenters.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Year picker */}
              <div className="topbar-select-wrap">
                <span className="topbar-select-icon"><CalendarIcon size={14} /></span>
                <select
                  className="hdr-select"
                  value={selectedYear}
                  onChange={e => { setSelectedYear(Number(e.target.value)); setRefreshKey(k => k + 1); }}
                >
                  {YEARS.map(y => <option key={y}>{y}</option>)}
                </select>
              </div>

              {/* Month picker */}
              <div className="topbar-select-wrap">
                <span className="topbar-select-icon"><CalendarIcon size={14} /></span>
                <select
                  className="hdr-select"
                  value={selectedMonth}
                  onChange={e => { setSelectedMonth(e.target.value); setRefreshKey(k => k + 1); }}
                >
                  {MONTHS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>

            {/* Status line: loading dots while fetching, else "data as of" note */}
            {panelLoading ? (
              <span className="hdr-loading">
                <span className="ai-pulse" style={{ fontSize: 8 }}>●</span>
                <span className="ai-pulse" style={{ fontSize: 8, animationDelay: "0.2s" }}>●</span>
                <span className="ai-pulse" style={{ fontSize: 8, animationDelay: "0.4s" }}>●</span>
                Loading…
              </span>
            ) : (
              <span className="data-as-of"><InfoIcon size={14} /> Data as of {dataAsOf}</span>
            )}
          </div>
        </header>

        {/* ── Dashboard panels ── */}
        {tab === "revenue"      && <Revenue      key={`rev-${refreshKey}`}  apiBase={API_BASE} month={month} center={center} onData={handlePanelData} aiInsights={() => renderAiInsights("revenue")}      />}
        {tab === "leaderboard"  && <Leaderboard  key={`lb-${refreshKey}`}   apiBase={API_BASE} month={month} center={center} onData={handlePanelData} aiInsights={() => renderAiInsights("leaderboard")}  />}
        {tab === "appointments" && <Appointments key={`appt-${refreshKey}`} apiBase={API_BASE} month={month} center={center} onData={handlePanelData} aiInsights={() => renderAiInsights("appointments")} />}
        {tab === "utilization"  && <Utilization  key={`util-${refreshKey}`} apiBase={API_BASE} month={month} center={center} onData={handlePanelData} aiInsights={() => renderAiInsights("utilization")}  />}
      </div>
    </div>
  );
}
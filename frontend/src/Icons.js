// ============================================================
// Icons.js — shared line-art icon set
// Thin-stroke style to match the reference design. Each icon is
// a plain SVG that inherits its color from CSS (uses currentColor),
// so dropping one into .kpi-icon / .sidebar-btn-icon / etc. will
// automatically pick up var(--accent) or whatever color the
// parent element sets.
//
// Usage:
//   import { DollarIcon, TrendingUpIcon } from "./Icons";
//   <span className="kpi-icon"><DollarIcon size={18} /></span>
// ============================================================

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function Icon({ size = 16, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...base}
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ── KPI card icons ── */

export function DollarIcon(props) {
  return (
    <Icon {...props}>
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </Icon>
  );
}

export function TrendingUpIcon(props) {
  return (
    <Icon {...props}>
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="14 7 21 7 21 14" />
    </Icon>
  );
}

export function CalendarIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <line x1="16" y1="3" x2="16" y2="7" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </Icon>
  );
}

export function ClockIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </Icon>
  );
}

export function StarIcon(props) {
  return (
    <Icon {...props}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </Icon>
  );
}

/* ── Secondary KPI row (ASP / cash sales / cash mix) ── */

export function DropletIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />
    </Icon>
  );
}

export function CashIcon(props) {
  return (
    <Icon {...props}>
      <rect x="2" y="6" width="16" height="11" rx="2" />
      <circle cx="10" cy="11.5" r="2.5" />
      <path d="M21 9v7a2 2 0 0 1-2 2H8" />
    </Icon>
  );
}

export function PieChartIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 3v9l7.8 4.5" />
      <circle cx="12" cy="12" r="9" />
    </Icon>
  );
}

/* ── Nav / tab icons ── */

export function ChartBarIcon(props) {
  return (
    <Icon {...props}>
      <line x1="3" y1="20" x2="21" y2="20" />
      <rect x="5" y="13" width="3.5" height="7" rx="0.9" fill="currentColor" stroke="none" />
      <rect x="10.25" y="9" width="3.5" height="11" rx="0.9" fill="currentColor" stroke="none" />
      <rect x="15.5" y="6" width="3.5" height="14" rx="0.9" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function TrophyIcon(props) {
  return (
    <Icon {...props}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4.5a2 2 0 0 0 0 4H7" />
      <path d="M17 5h2.5a2 2 0 0 1 0 4H17" />
      <path d="M9.5 21h5" />
      <path d="M12 17v4" />
    </Icon>
  );
}

export function AppointmentsIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <line x1="16" y1="3" x2="16" y2="7" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M8.5 14.5l2 2 4-4.5" />
    </Icon>
  );
}

/* ── Chrome / UI icons ── */

export function PinIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 22s7-7.58 7-12A7 7 0 0 0 5 10c0 4.42 7 12 7 12Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Icon>
  );
}

export function HeadsetIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 14a8 8 0 1 1 16 0" />
      <rect x="2.3" y="13" width="4" height="7.2" rx="2" />
      <rect x="17.7" y="13" width="4" height="7.2" rx="2" />
    </Icon>
  );
}

export function ChevronDownIcon(props) {
  return (
    <Icon {...props}>
      <polyline points="6 9 12 15 18 9" />
    </Icon>
  );
}

export function LogoutIcon(props) {
  return (
    <Icon {...props}>
      <path d="M15 17l5-5-5-5" />
      <line x1="20" y1="12" x2="9" y2="12" />
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    </Icon>
  );
}

export function InfoIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <circle cx="12" cy="7.5" r="0.75" fill="currentColor" stroke="none" />
    </Icon>
  );
}

/* ── Status / utilization icons ── */

export function GaugeIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 16a8 8 0 0 1 16 0" />
      <line x1="12" y1="16" x2="15.3" y2="11.2" />
      <circle cx="12" cy="16" r="1.1" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function AlertCircleIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="13" />
      <circle cx="12" cy="16" r="0.75" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function XCircleIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <line x1="9.5" y1="9.5" x2="14.5" y2="14.5" />
      <line x1="14.5" y1="9.5" x2="9.5" y2="14.5" />
    </Icon>
  );
}

export function RepeatIcon(props) {
  return (
    <Icon {...props}>
      <path d="M17 2.5l4 4-4 4" />
      <path d="M3 11.5v-2a4 4 0 0 1 4-4h14" />
      <path d="M7 21.5l-4-4 4-4" />
      <path d="M21 12.5v2a4 4 0 0 1-4 4H3" />
    </Icon>
  );
}

export function UserPlusIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <line x1="18" y1="8" x2="18" y2="14" />
      <line x1="15" y1="11" x2="21" y2="11" />
    </Icon>
  );
}

export function ZapIcon(props) {
  return (
    <Icon {...props}>
      <polygon points="12 2 5 14 11 14 9 22 19 9 13 9 12 2" />
    </Icon>
  );
}

export function PlusCircleIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </Icon>
  );
}

/* ── AI insights / chrome icons ── */

export function SparkleIcon(props) {
  return (
    <Icon {...props} strokeLinejoin="round">
      <path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" />
    </Icon>
  );
}

export function RefreshIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3.5 12a8.5 8.5 0 0 1 14.2-6.3L20 8" />
      <path d="M20 3.5V8h-4.5" />
      <path d="M20.5 12a8.5 8.5 0 0 1-14.2 6.3L4 16" />
      <path d="M4 20.5V16h4.5" />
    </Icon>
  );
}

export function XIcon(props) {
  return (
    <Icon {...props}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </Icon>
  );
}

export function AlertTriangleIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 2.5 20h19L12 3.5Z" />
      <line x1="12" y1="9.5" x2="12" y2="14.5" />
      <circle cx="12" cy="17.2" r="0.7" fill="currentColor" stroke="none" />
    </Icon>
  );
}

/* ── Trend indicators (WoW, etc.) ── */

export function ArrowUpIcon(props) {
  return (
    <Icon {...props}>
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="6 11 12 5 18 11" />
    </Icon>
  );
}

export function ArrowDownIcon(props) {
  return (
    <Icon {...props}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="6 13 12 19 18 13" />
    </Icon>
  );
}
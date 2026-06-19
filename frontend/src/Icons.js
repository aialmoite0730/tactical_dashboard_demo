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
      <rect x="3" y="13" width="4" height="7" rx="0.6" />
      <rect x="10" y="9" width="4" height="11" rx="0.6" />
      <rect x="17" y="5" width="4" height="15" rx="0.6" />
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

/* ── Larger illustrative art for the secondary stat-card row ──
   These are bigger, more detailed line drawings (not the small
   circular KPI badges) meant to sit on the right side of a card,
   the way the ASP / Cash Sales / Cash-vs-Total tiles look. ── */

export function DropletLeafArt({ size = 56, ...rest }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 64 64"
      fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}
    >
      {/* Main dropper bottle — elegant curves, semi-filled */}
      <defs>
        <linearGradient id="bottleGrad" x1="0%" y1="0%" x2="100%">
          <stop offset="0%" stopColor="var(--secondary-brand)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--secondary-brand)" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      
      {/* Bottle body */}
      <path
        d="M 28 12 L 24 18 Q 22 22 22 28 L 22 44 Q 22 48 26 48 L 38 48 Q 42 48 42 44 L 42 28 Q 42 22 40 18 L 36 12 Z"
        fill="url(#bottleGrad)"
        stroke="var(--secondary-brand)"
        strokeWidth="1.2"
      />
      
      {/* Bottle cap/dropper top */}
      <rect x="28" y="6" width="8" height="6" rx="1.5" fill="var(--secondary-brand)" opacity="0.8" />
      <circle cx="32" cy="5" r="1.5" fill="var(--secondary-brand)" />
      
      {/* Liquid fill line inside */}
      <path
        d="M 24 34 Q 24 32 26 32 L 38 32 Q 40 32 40 34"
        stroke="var(--secondary-brand)"
        strokeWidth="0.8"
        opacity="0.4"
      />
      
      {/* Left leaf — elegant curves */}
      <path
        d="M 12 36 Q 10 38 12 42 Q 14 40 14 36 Q 14 34 12 36 Z"
        fill="var(--secondary-brand)"
        opacity="0.6"
      />
      <path
        d="M 12 36 Q 12 38 12 42"
        stroke="var(--secondary-brand)"
        strokeWidth="0.6"
        opacity="0.4"
      />
      
      {/* Right leaf — elegant curves */}
      <path
        d="M 52 36 Q 54 38 52 42 Q 50 40 50 36 Q 50 34 52 36 Z"
        fill="var(--secondary-brand)"
        opacity="0.6"
      />
      <path
        d="M 52 36 Q 52 38 52 42"
        stroke="var(--secondary-brand)"
        strokeWidth="0.6"
        opacity="0.4"
      />
      
      {/* Small center leaf accent */}
      <path
        d="M 32 50 L 30 54 Q 32 55 34 54 Z"
        fill="var(--secondary-brand)"
        opacity="0.5"
      />
    </svg>
  );
}

export function CashStackArt({ size = 56, ...rest }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 64 64"
      fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}
    >
      <defs>
        <linearGradient id="billGrad" x1="0%" y1="0%" x2="100%">
          <stop offset="0%" stopColor="var(--champagne)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="var(--champagne)" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      
      {/* Back bill (rotated) */}
      <rect
        x="8" y="28" width="30" height="16" rx="2.5"
        fill="url(#billGrad)"
        stroke="var(--champagne)"
        strokeWidth="1"
        opacity="0.6"
        transform="rotate(-6 23 36)"
      />
      
      {/* Middle bill */}
      <rect
        x="10" y="22" width="32" height="18" rx="2.5"
        fill="url(#billGrad)"
        stroke="var(--champagne)"
        strokeWidth="1.1"
        opacity="0.8"
      />
      
      {/* Bill accent lines */}
      <line x1="14" y1="22" x2="14" y2="40" stroke="var(--champagne)" strokeWidth="0.6" opacity="0.3" />
      <line x1="38" y1="22" x2="38" y2="40" stroke="var(--champagne)" strokeWidth="0.6" opacity="0.3" />
      <line x1="18" y1="31" x2="34" y2="31" stroke="var(--champagne)" strokeWidth="0.5" opacity="0.2" />
      
      {/* Coin stack on the right */}
      <g transform="translate(42, 32)">
        {/* Back coin */}
        <ellipse cx="0" cy="-4" rx="8" ry="3.5" fill="var(--champagne)" opacity="0.5" />
        <path
          d="M -8 -4 Q -8 -2 0 0 Q 8 -2 8 -4"
          fill="var(--champagne)"
          opacity="0.6"
        />
        
        {/* Middle coin */}
        <ellipse cx="0" cy="0" rx="8.5" ry="4" fill="var(--champagne)" opacity="0.7" />
        <path
          d="M -8.5 0 Q -8.5 2 0 4.5 Q 8.5 2 8.5 0"
          fill="var(--champagne)"
          opacity="0.85"
        />
        
        {/* Front coin */}
        <ellipse cx="0" cy="4" rx="8" ry="3.5" fill="var(--champagne)" opacity="0.9" />
        <path
          d="M -8 4 Q -8 6 0 8 Q 8 6 8 4"
          fill="var(--champagne)"
          opacity="1"
        />
        
        {/* Coin shine */}
        <line x1="-4" y1="0" x2="4" y2="0" stroke="white" strokeWidth="0.5" opacity="0.4" />
      </g>
    </svg>
  );
}

export function CashPieArt({ pct = 0, size = 56, ...rest }) {
  const clamped = Math.max(0.001, Math.min(pct || 0, 99.999));
  const r = 20, cx = 28, cy = 32;
  const angle = (clamped / 100) * 360;
  const toRad = (d) => ((d - 90) * Math.PI) / 180;
  const sx = cx + r * Math.cos(toRad(0));
  const sy = cy + r * Math.sin(toRad(0));
  const ex = cx + r * Math.cos(toRad(angle));
  const ey = cy + r * Math.sin(toRad(angle));
  const largeArc = angle > 180 ? 1 : 0;
  const slicePath = `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey} Z`;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" {...rest}>
      <defs>
        <linearGradient id="pieBg" x1="0%" y1="0%" x2="100%">
          <stop offset="0%" stopColor="var(--sand)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--sand)" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      
      {/* Background circle (the "empty" part) */}
      <circle cx={cx} cy={cy} r={r} fill="url(#pieBg)" />
      
      {/* Filled slice (the actual percentage) */}
      <path d={slicePath} fill="var(--accent)" opacity="0.85" />
      
      {/* Border/outline */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth="1.2" />
      
      {/* Subtle inner circle for depth */}
      <circle cx={cx} cy={cy} r={r * 0.5} fill="none" stroke="var(--accent)" strokeWidth="0.5" opacity="0.2" />
      
      {/* Optional dollar sign accent in center (subtle) */}
      <text
        x={cx} y={cy + 4}
        fontSize="10"
        fontWeight="700"
        textAnchor="middle"
        fill="var(--accent)"
        opacity="0.4"
      >
        $
      </text>
    </svg>
  );
}
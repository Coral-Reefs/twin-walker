import type { SVGProps } from "react";

/** Small stroke icon set, drawn on a 24×24 grid. Decorative by default (aria-hidden). */
const PATHS = {
  parent: (
    <>
      <circle cx="8" cy="4.5" r="2.5" />
      <path d="M8 8v7m0 0-3 6m3-6 3 6M4.5 11h7" />
      <circle cx="17" cy="11" r="2" />
      <path d="M17 13.5v4m0 0-2 3.5m2-3.5 2 3.5M14.5 15.5h5" />
    </>
  ),
  "night-shift": <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  wheelchair: (
    <>
      <circle cx="11" cy="4" r="2" />
      <path d="M11 7v6h5l2 6" />
      <path d="M11 10h4" />
      <path d="M8 10.5a5.5 5.5 0 1 0 7.6 7" />
    </>
  ),
  "walking-aid": (
    <>
      <circle cx="10" cy="4" r="2" />
      <path d="M10 7.5 9 13l3 3v5M9 13l-3 8M10 9.5l4.5 2" />
      <path d="M15 11v10M14 11h2.5" />
    </>
  ),
  seating: <path d="M4 11h16M5 11V7h14v4M6 11v7M18 11v7M4 14h16" />,
  "no-seating": (
    <>
      <path d="M4 11h16M5 11V7h14v4M6 11v7M18 11v7" />
      <path d="M3 3l18 18" />
    </>
  ),
  crossing: <path d="M4 5v14M20 5v14M8 7h8M8 12h8M8 17h8" />,
  pickup: <path d="M3 21h18M5 21V10l7-5 7 5v11M10 21v-5h4v5M9 11h6" />,
  steps: <path d="M3 20h5v-5h5v-5h5V5h3" />,
  detour: (
    <>
      <path d="M5 20v-8a4 4 0 0 1 8 0v2a4 4 0 0 0 8 0V5" />
      <path d="M18 8l3-3 3 3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  warning: (
    <>
      <path d="M12 3 22 20H2L12 3z" />
      <path d="M12 10v4.5M12 17.2v.01" />
    </>
  ),
  play: <path d="M7 4.5v15l12.5-7.5L7 4.5z" fill="currentColor" />,
  pause: <path d="M8 5v14M16 5v14" />,
  replay: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.8-6.3L3.5 8.3" />
      <path d="M3.5 3.5v4.8h4.8" />
    </>
  ),
  next: <path d="M6 5l7 7-7 7M17 5v14" />,
  prev: <path d="M18 5l-7 7 7 7M7 5v14" />,
  "arrow-up": <path d="M12 19V5M6 11l6-6 6 6" />,
  "arrow-down": <path d="M12 5v14M6 13l6 6 6-6" />,
  "trend-up": <path d="M12 5l7 12H5l7-12z" fill="currentColor" />,
  "trend-down": <path d="M12 19 5 7h14l-7 12z" fill="currentColor" />,
  minus: <path d="M5 12h14" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.01" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" />
      <path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" />
    </>
  ),
  "database-off": (
    <>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" />
      <path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13" />
      <path d="M3 3l18 18" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.7L20 8.5" />
      <path d="M20 3.5v5h-5" />
    </>
  ),
  ballot: (
    <>
      <path d="M4 21h16M6 21V11h12v10" />
      <path d="M9 6.5l2 2 4-4.5" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" />
    </>
  ),
  walk: (
    <>
      <circle cx="13" cy="4" r="2" />
      <path d="M11 21l2-6-3-3 1-5 4 3 3 1M9 12l-2 3" />
    </>
  ),
  sparkle: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
  /** If provided the icon is announced; otherwise it is hidden from assistive tech. */
  label?: string;
}

export function Icon({ name, size = 20, label, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

/** Raw paths for embedding inside the map SVG. */
export function IconGlyph({ name, x, y, size, color, strokeWidth = 2.2 }: { name: IconName; x: number; y: number; size: number; color: string; strokeWidth?: number }) {
  const scale = size / 24;
  return (
    <g
      transform={`translate(${x - size / 2} ${y - size / 2}) scale(${scale})`}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </g>
  );
}

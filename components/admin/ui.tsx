import type { ReactNode, SVGProps } from "react";
import type { ProjectStatus, SuggestionStatus } from "@/lib/admin/types";

/** Small stroke icon set for the admin screens (same 24×24 stroke style as components/system/Icon.tsx). */
const PATHS = {
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  inbox: <path d="M3 13l3-8h12l3 8v6H3v-6zM3 13h5l1 3h6l1-3h5" />,
  logout: <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  download: <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />,
  bolt: <path d="M13 3 5 14h6l-1 7 8-11h-6l1-7z" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3 22 20H2L12 3z" />
      <path d="M12 10v4.5M12 17.2v.01" />
    </>
  ),
  play: <path d="M7 4.5v15l12.5-7.5L7 4.5z" fill="currentColor" />,
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.7L20 8.5" />
      <path d="M20 3.5v5h-5" />
    </>
  ),
  dot: <circle cx="12" cy="12" r="4" fill="currentColor" />,
  ballot: (
    <>
      <path d="M4 21h16M6 21V11h12v10" />
      <path d="M9 6.5l2 2 4-4.5" />
    </>
  ),
  gantt: <path d="M4 6h9M8 12h12M6 18h8M4 3v18" />,
} as const;

export type AIconName = keyof typeof PATHS;

interface AIconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: AIconName;
  size?: number;
}

export function AIcon({ name, size = 18, strokeWidth = 2, ...rest }: AIconProps) {
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
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Class strings that mirror the buttons / fields already used in the resident app
// ---------------------------------------------------------------------------

export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60";
export const btnGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60";
export const btnDanger =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-bad/40 bg-white px-3 py-2 text-sm font-semibold text-bad hover:bg-bad-soft disabled:cursor-not-allowed disabled:opacity-60";
export const inputCls =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand";
export const cardCls = "rounded-2xl border border-line bg-card p-4 shadow-sm";

export function Badge({ cls, icon, children }: { cls: string; icon?: AIconName; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {icon && <AIcon name={icon} size={12} />}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Status / colour metadata. Meaning is always carried by a word and an icon, never colour alone.
// ---------------------------------------------------------------------------

export const SUGGESTION_STATUS: Record<SuggestionStatus, { label: string; cls: string; icon: AIconName }> = {
  new: { label: "New", cls: "bg-brand-soft text-brand-strong", icon: "dot" },
  reviewing: { label: "Reviewing", cls: "bg-warn-soft text-warn", icon: "clock" },
  planned: { label: "Planned", cls: "bg-good-soft text-good", icon: "check" },
  declined: { label: "Declined", cls: "bg-stone-100 text-ink-muted", icon: "x" },
};

export const PROJECT_STATUS: Record<ProjectStatus, { label: string; cls: string; icon: AIconName }> = {
  planned: { label: "Planned", cls: "bg-stone-100 text-ink", icon: "calendar" },
  in_progress: { label: "In progress", cls: "bg-brand-soft text-brand-strong", icon: "play" },
  blocked: { label: "Blocked", cls: "bg-bad-soft text-bad", icon: "warning" },
  done: { label: "Done", cls: "bg-good-soft text-good", icon: "check" },
};

/** Same hues as the resident app's design chart (components/jury/designFill.tsx), keyed by BBR proposal id. */
const OPTION_COLOR: Record<string, string> = {
  seating: "#15803d",
  crossing: "#1d4ed8",
  pickup: "#b45309",
};
export const CUSTOM_COLOR = "#0f5c4d";
export const optionColor = (id: string | null): string => (id ? (OPTION_COLOR[id] ?? CUSTOM_COLOR) : CUSTOM_COLOR);

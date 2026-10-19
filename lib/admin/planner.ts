import type { JurySuggestion, ProjectDraft } from "./types";

/**
 * Pure date + Gantt helpers (no React). Dates are ISO "YYYY-MM-DD" strings, and all day
 * arithmetic is done in UTC day numbers so daylight-saving shifts can never move a bar.
 */

export const DAY_MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Days since 1970-01-01 for an ISO date. */
export function toDay(iso: string): number {
  const [y = 1970, m = 1, d = 1] = iso.slice(0, 10).split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function fromDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export const addDays = (iso: string, n: number): string => fromDay(toDay(iso) + n);

/** Monday = 0 … Sunday = 6 */
export function weekdayMon(day: number): number {
  return (new Date(day * DAY_MS).getUTCDay() + 6) % 7;
}

/** The user's local calendar date as ISO. */
export function todayISO(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Inclusive length in days. */
export const durationDays = (p: { start_date: string; end_date: string }): number =>
  toDay(p.end_date) - toDay(p.start_date) + 1;

export function fmtDate(iso: string): string {
  const [y = 1970, m = 1, d = 1] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1] ?? ""} ${y}`;
}

export function timeAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return fmtDate(iso);
}

// ---------------------------------------------------------------------------
// Timeline geometry
// ---------------------------------------------------------------------------

export const ZOOMS = [
  { id: "days", label: "Days", px: 36 },
  { id: "weeks", label: "Weeks", px: 14 },
  { id: "months", label: "Months", px: 5 },
] as const;
export type ZoomId = (typeof ZOOMS)[number]["id"];

export interface Range {
  /** First visible day (always a Monday). */
  startDay: number;
  /** Last visible day, inclusive. */
  endDay: number;
}

/** Visible window: all projects plus today, with breathing room, starting on a Monday. */
export function timelineRange(projects: { start_date: string; end_date: string }[], today: string, minDays = 84): Range {
  const t = toDay(today);
  let min = t - 7;
  let max = t + minDays;
  for (const p of projects) {
    min = Math.min(min, toDay(p.start_date) - 7);
    max = Math.max(max, toDay(p.end_date) + 14);
  }
  min -= weekdayMon(min);
  return { startDay: min, endDay: max };
}

export interface MonthSegment {
  label: string;
  left: number;
  width: number;
}

export function monthSegments(range: Range, px: number): MonthSegment[] {
  const out: MonthSegment[] = [];
  let cur = range.startDay;
  while (cur <= range.endDay) {
    const date = new Date(cur * DAY_MS);
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth();
    const nextMonth = Math.round(Date.UTC(y, m + 1, 1) / DAY_MS);
    const end = Math.min(nextMonth, range.endDay + 1);
    out.push({ label: `${MONTHS[m] ?? ""} ${y}`, left: (cur - range.startDay) * px, width: (end - cur) * px });
    cur = end;
  }
  return out;
}

export interface Tick {
  left: number;
  /** Empty string = draw the grid line without a label. */
  label: string;
  weekend: boolean;
}

/** Daily ticks when zoomed in, otherwise one per Monday. */
export function dateTicks(range: Range, px: number): Tick[] {
  const daily = px >= 28;
  const labelled = px >= 10;
  const out: Tick[] = [];
  for (let day = range.startDay; day <= range.endDay; day++) {
    const wd = weekdayMon(day);
    if (!daily && wd !== 0) continue;
    out.push({
      left: (day - range.startDay) * px,
      label: labelled ? String(new Date(day * DAY_MS).getUTCDate()) : "",
      weekend: daily && wd >= 5,
    });
  }
  return out;
}

export function barGeometry(p: { start_date: string; end_date: string }, range: Range, px: number): { left: number; width: number } {
  return { left: (toDay(p.start_date) - range.startDay) * px, width: durationDays(p) * px };
}

// ---------------------------------------------------------------------------
// Dragging / resizing
// ---------------------------------------------------------------------------

export type DragMode = "move" | "start" | "end";

/** Applies a whole-day delta. A project always keeps a minimum length of one day. */
export function applyDrag(
  orig: { start_date: string; end_date: string },
  mode: DragMode,
  deltaDays: number,
): { start_date: string; end_date: string } {
  const s = toDay(orig.start_date);
  const e = toDay(orig.end_date);
  if (mode === "move") return { start_date: fromDay(s + deltaDays), end_date: fromDay(e + deltaDays) };
  if (mode === "start") return { start_date: fromDay(Math.min(s + deltaDays, e)), end_date: orig.end_date };
  return { start_date: orig.start_date, end_date: fromDay(Math.max(e + deltaDays, s)) };
}

// ---------------------------------------------------------------------------
// Dependencies (finish-to-start)
// ---------------------------------------------------------------------------

interface Scheduled {
  id: string;
  start_date: string;
  end_date: string;
  depends_on: string[];
}

/** Predecessors that have not finished by the day this project starts. */
export function dependencyConflicts<T extends Scheduled>(p: T, byId: Map<string, T>): T[] {
  const out: T[] = [];
  for (const id of p.depends_on) {
    const pred = byId.get(id);
    if (pred && toDay(p.start_date) <= toDay(pred.end_date)) out.push(pred);
  }
  return out;
}

/** True if giving `id` these dependencies would create a loop (including depending on itself). */
export function wouldCreateCycle(projects: { id: string; depends_on: string[] }[], id: string, deps: string[]): boolean {
  const edges = new Map(projects.map((p) => [p.id, p.depends_on]));
  edges.set(id, deps);
  const seen = new Set<string>();
  const stack = [...deps];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (cur === id) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const next of edges.get(cur) ?? []) stack.push(next);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Draft helpers (pre-filled projects)
// ---------------------------------------------------------------------------

/** Starts next Monday and runs for 12 weeks. */
export function defaultProjectDates(today: string = todayISO()): { start: string; end: string } {
  const t = toDay(today);
  const start = t + (7 - weekdayMon(t));
  return { start: fromDay(start), end: fromDay(start + 12 * 7 - 1) };
}

export function draftFromOption(
  o: { id: string; name: string; cost: number; description: string },
  today: string = todayISO(),
): Partial<ProjectDraft> {
  const { start, end } = defaultProjectDates(today);
  return {
    title: o.name,
    description: o.description,
    option_id: o.id,
    budget_rm: o.cost,
    start_date: start,
    end_date: end,
    status: "planned",
    progress: 0,
  };
}

export function draftFromSuggestion(s: Pick<JurySuggestion, "body" | "place">, today: string = todayISO()): Partial<ProjectDraft> {
  const { start, end } = defaultProjectDates(today);
  const firstClause = s.body.trim().split(/[.!?\n]/)[0]?.trim() ?? "";
  const title = firstClause.length > 60 ? `${firstClause.slice(0, 57).trimEnd()}…` : firstClause || "Resident suggestion";
  return {
    title,
    description: `${s.body.trim()}\n\nSource: resident suggestion (${s.place}).`,
    start_date: start,
    end_date: end,
    status: "planned",
    progress: 0,
  };
}

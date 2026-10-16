/**
 * Browser storage helpers. Storage can be unavailable (private mode, blocked site data),
 * so every access is wrapped and falls back to a sensible default.
 */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — keep working in memory */
  }
}

export function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export const KEYS = {
  session: "dayzero.session",
  voted: "dayzero.votedSessions",
  localVotes: "dayzero.localVotes",
  pendingVotes: "dayzero.pendingVotes",
  pendingEvents: "dayzero.pendingEvents",
} as const;

export const EVENT_NAMES = ["persona_selected", "design_toggled", "vote_submitted"] as const;
export type EventName = (typeof EVENT_NAMES)[number];

export interface PendingVote {
  session_id: string;
  ranking: string[];
}

export interface PendingEvent {
  session_id: string;
  name: EventName;
  props: Record<string, unknown>;
  created_at: string;
}

export const MAX_PENDING_EVENTS = 200;

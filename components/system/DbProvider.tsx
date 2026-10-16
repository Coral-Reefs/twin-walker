"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getSupabase, withTimeout } from "@/lib/supabase/client";
import {
  KEYS,
  MAX_PENDING_EVENTS,
  newId,
  readJson,
  writeJson,
  type EventName,
  type PendingEvent,
  type PendingVote,
} from "@/lib/supabase/storage";

export type DbStatus = "connecting" | "online" | "offline" | "unconfigured";

interface DbContextValue {
  status: DbStatus;
  error: string | null;
  /** Rankings stored in Supabase (only when online). */
  remoteRankings: unknown[];
  /** Every ranking cast on this device (kept for offline display). */
  localRankings: string[][];
  pendingVotes: PendingVote[];
  pendingEventCount: number;
  hasVoted: boolean;
  retrying: boolean;
  retry: () => Promise<void>;
  submitVote: (ranking: string[]) => Promise<"synced" | "queued" | "local">;
  track: (name: EventName, props?: Record<string, unknown>) => void;
  newVisitor: () => void;
}

const DbContext = createContext<DbContextValue | null>(null);

export function useDb(): DbContextValue {
  const ctx = useContext(DbContext);
  if (!ctx) throw new Error("useDb must be used inside <DbProvider>");
  return ctx;
}

const POLL_MS = 20_000;
const UNIQUE_VIOLATION = "23505";

export function DbProvider({ children }: { children: ReactNode }) {
  const client = getSupabase();
  const [status, setStatus] = useState<DbStatus>(client ? "connecting" : "unconfigured");
  const [error, setError] = useState<string | null>(null);
  const [remoteRankings, setRemoteRankings] = useState<unknown[]>([]);
  const [localRankings, setLocalRankings] = useState<string[][]>([]);
  const [pendingVotes, setPendingVotes] = useState<PendingVote[]>([]);
  const [pendingEventCount, setPendingEventCount] = useState(0);
  const [sessionId, setSessionId] = useState("");
  const [votedSessions, setVotedSessions] = useState<string[]>([]);
  const [retrying, setRetrying] = useState(false);
  const busy = useRef(false);

  /** Insert one vote. A duplicate session id means it was already stored (e.g. a retry), which counts as success. */
  const insertVote = useCallback(
    async (vote: PendingVote) => {
      if (!client) throw new Error("No database configured");
      const { error: e } = await withTimeout(client.from("votes").insert(vote));
      if (e && e.code !== UNIQUE_VIOLATION) throw new Error(e.message);
    },
    [client],
  );

  // Restore device state after mount (localStorage is not available during SSR).
  useEffect(() => {
    let sid = readJson<string>(KEYS.session, "");
    if (!sid) {
      sid = newId();
      writeJson(KEYS.session, sid);
    }
    setSessionId(sid);
    setVotedSessions(readJson<string[]>(KEYS.voted, []));
    setLocalRankings(readJson<string[][]>(KEYS.localVotes, []));
    setPendingVotes(readJson<PendingVote[]>(KEYS.pendingVotes, []));
    setPendingEventCount(readJson<PendingEvent[]>(KEYS.pendingEvents, []).length);
  }, []);

  /** Push queued votes/events, then load rankings. Never throws. */
  const sync = useCallback(async () => {
    if (!client || busy.current) return;
    busy.current = true;
    try {
      const votes = readJson<PendingVote[]>(KEYS.pendingVotes, []);
      for (const vote of votes) {
        await insertVote(vote);
        const rest = readJson<PendingVote[]>(KEYS.pendingVotes, []).filter((v) => v.session_id !== vote.session_id);
        writeJson(KEYS.pendingVotes, rest);
        setPendingVotes(rest);
      }
      const events = readJson<PendingEvent[]>(KEYS.pendingEvents, []);
      if (events.length > 0) {
        const { error: e } = await withTimeout(client.from("events").insert(events));
        if (e) throw new Error(e.message);
        writeJson(KEYS.pendingEvents, []);
        setPendingEventCount(0);
      }
      const { data, error: e } = await withTimeout(client.from("votes").select("ranking").limit(5000));
      if (e) throw new Error(e.message);
      setRemoteRankings((data ?? []).map((r: { ranking: unknown }) => r.ranking));
      setStatus("online");
      setError(null);
    } catch (err) {
      setStatus("offline");
      setError(err instanceof Error ? err.message : "Database unreachable");
    } finally {
      busy.current = false;
    }
  }, [client, insertVote]);

  useEffect(() => {
    if (!client) return undefined;
    void sync();
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void sync();
    }, POLL_MS);
    const goOnline = () => void sync();
    const goOffline = () => {
      setStatus("offline");
      setError("This device is offline");
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [client, sync]);

  const retry = useCallback(async () => {
    if (!client) return;
    setRetrying(true);
    setStatus("connecting");
    await sync();
    setRetrying(false);
  }, [client, sync]);

  const queueEvent = useCallback((event: PendingEvent) => {
    const queue = [...readJson<PendingEvent[]>(KEYS.pendingEvents, []), event].slice(-MAX_PENDING_EVENTS);
    writeJson(KEYS.pendingEvents, queue);
    setPendingEventCount(queue.length);
  }, []);

  const track = useCallback(
    (name: EventName, props: Record<string, unknown> = {}) => {
      if (!client || !sessionId) return;
      const event: PendingEvent = { session_id: sessionId, name, props, created_at: new Date().toISOString() };
      if (status !== "online") {
        queueEvent(event);
        return;
      }
      // Fire and forget: analytics must never slow the demo down.
      withTimeout(client.from("events").insert(event))
        .then(({ error: e }) => {
          if (e) queueEvent(event);
        })
        .catch(() => queueEvent(event));
    },
    [client, sessionId, status, queueEvent],
  );

  const submitVote = useCallback(
    async (ranking: string[]): Promise<"synced" | "queued" | "local"> => {
      const local = [...readJson<string[][]>(KEYS.localVotes, []), ranking];
      writeJson(KEYS.localVotes, local);
      setLocalRankings(local);
      const voted = [...readJson<string[]>(KEYS.voted, []), sessionId];
      writeJson(KEYS.voted, voted);
      setVotedSessions(voted);
      track("vote_submitted", { ranking });

      if (!client) return "local";
      const vote: PendingVote = { session_id: sessionId, ranking };
      try {
        await insertVote(vote);
        setRemoteRankings((prev) => [...prev, ranking]);
        void sync();
        return "synced";
      } catch (err) {
        const queue = [...readJson<PendingVote[]>(KEYS.pendingVotes, []), vote];
        writeJson(KEYS.pendingVotes, queue);
        setPendingVotes(queue);
        setStatus("offline");
        setError(err instanceof Error ? err.message : "Database unreachable");
        return "queued";
      }
    },
    [client, sessionId, sync, track, insertVote],
  );

  /** Kiosk mode: hand the device to the next visitor with a fresh anonymous session. */
  const newVisitor = useCallback(() => {
    const sid = newId();
    writeJson(KEYS.session, sid);
    setSessionId(sid);
  }, []);

  const value = useMemo<DbContextValue>(
    () => ({
      status,
      error,
      remoteRankings,
      localRankings,
      pendingVotes,
      pendingEventCount,
      hasVoted: !!sessionId && votedSessions.includes(sessionId),
      retrying,
      retry,
      submitVote,
      track,
      newVisitor,
    }),
    [status, error, remoteRankings, localRankings, pendingVotes, pendingEventCount, sessionId, votedSessions, retrying, retry, submitVote, track, newVisitor],
  );

  return <DbContext.Provider value={value}>{children}</DbContext.Provider>;
}

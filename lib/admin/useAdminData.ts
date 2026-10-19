"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload, Session } from "@supabase/supabase-js";
import { withTimeout } from "@/lib/supabase/client";
import { getAdminSupabase } from "./supabase";
import type { JurySuggestion, JuryVote, PlannerProject, ProjectDraft, SuggestionPatch } from "./types";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export type AuthState =
  | { phase: "unconfigured" }
  | { phase: "loading" }
  | { phase: "signed-out" }
  | { phase: "forbidden"; email: string }
  | { phase: "admin"; email: string };

/** Email + password sign-in. Only users with app_metadata.role = "admin" get through; RLS enforces the same server-side. */
export function useAdminAuth() {
  const client = getAdminSupabase();
  const [state, setState] = useState<AuthState>(client ? { phase: "loading" } : { phase: "unconfigured" });

  useEffect(() => {
    if (!client) return undefined;
    let alive = true;
    const apply = (session: Session | null) => {
      if (!alive) return;
      if (!session) {
        setState({ phase: "signed-out" });
        return;
      }
      const email = session.user.email ?? "unknown user";
      const role = (session.user.app_metadata as Record<string, unknown> | undefined)?.role;
      setState(role === "admin" ? { phase: "admin", email } : { phase: "forbidden", email });
    };
    void client.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = client.auth.onAuthStateChange((_event, session) => apply(session));
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      if (!client) return "Supabase is not configured.";
      const { error } = await client.auth.signInWithPassword({ email, password });
      return error ? error.message : null;
    },
    [client],
  );

  const signOut = useCallback(async () => {
    if (client) await client.auth.signOut();
  }, [client]);

  return { state, signIn, signOut };
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export type LiveStatus = "connecting" | "live" | "polling" | "error";

const POLL_MS = 20_000;
const FRESH_MS = 8_000;

type Change = RealtimePostgresChangesPayload<Record<string, unknown>>;

function upsertBy<T>(list: T[], row: T, same: (a: T) => boolean): T[] {
  return list.some(same) ? list.map((x) => (same(x) ? row : x)) : [...list, row];
}

const newestFirst = (a: JurySuggestion, b: JurySuggestion) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0);

/**
 * Loads votes, suggestions and projects, then keeps them current:
 *   - realtime (Supabase postgres_changes) makes new feedback appear instantly,
 *   - a 20 s poll is the safety net if the realtime socket drops.
 * Mutations are optimistic; on failure the data is re-fetched and the error message is returned.
 */
export function useAdminData() {
  const client = getAdminSupabase();
  const [votes, setVotes] = useState<JuryVote[]>([]);
  const [suggestions, setSuggestions] = useState<JurySuggestion[]>([]);
  const [projects, setProjects] = useState<PlannerProject[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channelLive, setChannelLive] = useState(false);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const [arrivals, setArrivals] = useState(0);
  const [lastArrival, setLastArrival] = useState<JurySuggestion | null>(null);
  const known = useRef<Set<string> | null>(null);

  /** Marks suggestions the admin hasn't seen yet. The first load only records what already exists. */
  const noteArrivals = useCallback((rows: JurySuggestion[]) => {
    if (known.current === null) {
      known.current = new Set(rows.map((r) => r.id));
      return;
    }
    const seen = known.current;
    const added = rows.filter((r) => !seen.has(r.id));
    if (added.length === 0) return;
    added.forEach((r) => seen.add(r.id));
    const ids = added.map((r) => r.id);
    setFresh((prev) => new Set([...prev, ...ids]));
    setArrivals((n) => n + added.length);
    setLastArrival(added[0] ?? null);
    window.setTimeout(() => {
      setFresh((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }, FRESH_MS);
  }, []);

  const fetchAll = useCallback(async () => {
    if (!client) return;
    try {
      const [v, s, p] = await Promise.all([
        withTimeout(client.from("jury_votes").select("session_id, option_id, created_at, updated_at").limit(10000)),
        withTimeout(client.from("jury_suggestions").select("*").order("created_at", { ascending: false }).limit(1000)),
        withTimeout(client.from("planner_projects").select("*").order("sort_order").order("start_date")),
      ]);
      const failure = v.error ?? s.error ?? p.error;
      if (failure) throw new Error(failure.message);
      const suggestionRows = (s.data ?? []) as JurySuggestion[];
      noteArrivals(suggestionRows);
      setVotes((v.data ?? []) as JuryVote[]);
      setSuggestions(suggestionRows);
      setProjects((p.data ?? []) as PlannerProject[]);
      setLoaded(true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach the database");
    }
  }, [client, noteArrivals]);

  useEffect(() => {
    if (!client) return undefined;
    void fetchAll();

    const onSuggestion = (change: Change) => {
      if (change.eventType === "DELETE") {
        const id = (change.old as { id?: string }).id;
        if (id) setSuggestions((prev) => prev.filter((x) => x.id !== id));
        return;
      }
      const row = change.new as unknown as JurySuggestion;
      setSuggestions((prev) => upsertBy(prev, row, (x) => x.id === row.id).sort(newestFirst));
      // Before the first fetch completes, the fetch itself will include this row; counting it here
      // would seed `known` with a single id and make every existing suggestion look new.
      if (change.eventType === "INSERT" && known.current !== null) noteArrivals([row]);
    };
    const onVote = (change: Change) => {
      if (change.eventType === "DELETE") {
        const id = (change.old as { session_id?: string }).session_id;
        if (id) setVotes((prev) => prev.filter((x) => x.session_id !== id));
        return;
      }
      const row = change.new as unknown as JuryVote;
      setVotes((prev) => upsertBy(prev, row, (x) => x.session_id === row.session_id));
    };
    const onProject = (change: Change) => {
      if (change.eventType === "DELETE") {
        const id = (change.old as { id?: string }).id;
        if (id) setProjects((prev) => prev.filter((x) => x.id !== id));
        return;
      }
      const row = change.new as unknown as PlannerProject;
      setProjects((prev) => upsertBy(prev, row, (x) => x.id === row.id));
    };

    const channel = client
      .channel("dayzero-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "jury_suggestions" }, onSuggestion)
      .on("postgres_changes", { event: "*", schema: "public", table: "jury_votes" }, onVote)
      .on("postgres_changes", { event: "*", schema: "public", table: "planner_projects" }, onProject)
      .subscribe((status) => {
        setChannelLive(status === "SUBSCRIBED");
        // After (re)connecting, catch up on anything missed while the socket was down.
        if (status === "SUBSCRIBED") void fetchAll();
      });

    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchAll();
    }, POLL_MS);

    return () => {
      window.clearInterval(poll);
      void client.removeChannel(channel);
    };
  }, [client, fetchAll, noteArrivals]);

  const status: LiveStatus = error ? "error" : !loaded ? "connecting" : channelLive ? "live" : "polling";

  // ----- suggestion mutations ------------------------------------------------

  const updateSuggestion = useCallback(
    async (id: string, patch: SuggestionPatch): Promise<string | null> => {
      if (!client) return "Supabase is not configured.";
      setSuggestions((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
      try {
        const { error: e } = await withTimeout(client.from("jury_suggestions").update(patch).eq("id", id));
        if (e) throw new Error(e.message);
        return null;
      } catch (e) {
        void fetchAll();
        return e instanceof Error ? e.message : "Update failed";
      }
    },
    [client, fetchAll],
  );

  const deleteSuggestion = useCallback(
    async (id: string): Promise<string | null> => {
      if (!client) return "Supabase is not configured.";
      setSuggestions((prev) => prev.filter((x) => x.id !== id));
      try {
        const { error: e } = await withTimeout(client.from("jury_suggestions").delete().eq("id", id));
        if (e) throw new Error(e.message);
        return null;
      } catch (e) {
        void fetchAll();
        return e instanceof Error ? e.message : "Delete failed";
      }
    },
    [client, fetchAll],
  );

  // ----- project mutations ---------------------------------------------------

  const createProject = useCallback(
    async (draft: ProjectDraft): Promise<{ project: PlannerProject | null; error: string | null }> => {
      if (!client) return { project: null, error: "Supabase is not configured." };
      try {
        const nextOrder = projects.reduce((n, p) => Math.max(n, p.sort_order), 0) + 1;
        const { data, error: e } = await withTimeout(
          client
            .from("planner_projects")
            .insert({ ...draft, sort_order: nextOrder })
            .select()
            .single(),
        );
        if (e) throw new Error(e.message);
        const project = data as PlannerProject;
        setProjects((prev) => upsertBy(prev, project, (x) => x.id === project.id));
        return { project, error: null };
      } catch (e) {
        return { project: null, error: e instanceof Error ? e.message : "Could not create the project" };
      }
    },
    [client, projects],
  );

  /** Optimistic: the bar moves immediately (this runs its first setState synchronously, before any await). */
  const updateProject = useCallback(
    async (id: string, patch: Partial<ProjectDraft>): Promise<string | null> => {
      if (!client) return "Supabase is not configured.";
      setProjects((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
      try {
        const { error: e } = await withTimeout(client.from("planner_projects").update(patch).eq("id", id));
        if (e) throw new Error(e.message);
        return null;
      } catch (e) {
        void fetchAll();
        return e instanceof Error ? e.message : "Update failed";
      }
    },
    [client, fetchAll],
  );

  const deleteProject = useCallback(
    async (id: string): Promise<string | null> => {
      if (!client) return "Supabase is not configured.";
      const dependents = projects.filter((p) => p.depends_on.includes(id));
      setProjects((prev) => prev.filter((x) => x.id !== id).map((x) => (x.depends_on.includes(id) ? { ...x, depends_on: x.depends_on.filter((d) => d !== id) } : x)));
      setSuggestions((prev) => prev.map((x) => (x.project_id === id ? { ...x, project_id: null } : x)));
      try {
        const { error: e } = await withTimeout(client.from("planner_projects").delete().eq("id", id));
        if (e) throw new Error(e.message);
        // Remove the now-dangling dependency from anything that pointed at it.
        await Promise.all(
          dependents.map((p) =>
            withTimeout(
              client
                .from("planner_projects")
                .update({ depends_on: p.depends_on.filter((d) => d !== id) })
                .eq("id", p.id),
            ),
          ),
        );
        return null;
      } catch (e) {
        void fetchAll();
        return e instanceof Error ? e.message : "Delete failed";
      }
    },
    [client, projects, fetchAll],
  );

  return {
    votes,
    suggestions,
    projects,
    loaded,
    status,
    error,
    fresh,
    arrivals,
    lastArrival,
    refresh: fetchAll,
    updateSuggestion,
    deleteSuggestion,
    createProject,
    updateProject,
    deleteProject,
  };
}

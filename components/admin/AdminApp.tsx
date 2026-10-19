"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { PanelSkeleton } from "@/components/system/Skeleton";
import { draftFromSuggestion } from "@/lib/admin/planner";
import type { JurySuggestion, PlannerRequest, ProjectDraft } from "@/lib/admin/types";
import { useAdminAuth, useAdminData, type LiveStatus } from "@/lib/admin/useAdminData";
import FeedbackInbox from "./FeedbackInbox";
import Overview from "./Overview";
import ProjectPlanner from "./ProjectPlanner";
import { AIcon, type AIconName, btnGhost, btnPrimary, cardCls, inputCls } from "./ui";

type Tab = "overview" | "feedback" | "planner";

const LIVE_COPY: Record<LiveStatus, { text: string; detail: string; cls: string; icon: AIconName }> = {
  connecting: { text: "Connecting…", detail: "Loading resident feedback", cls: "bg-stone-100 text-ink", icon: "refresh" },
  live: { text: "Live", detail: "New feedback appears the moment a resident submits it", cls: "bg-good-soft text-good", icon: "bolt" },
  polling: { text: "Auto-refresh", detail: "Realtime is unavailable, so this page re-checks every 20 seconds", cls: "bg-warn-soft text-warn", icon: "refresh" },
  error: { text: "Disconnected", detail: "Could not reach the database", cls: "bg-bad-soft text-bad", icon: "warning" },
};

export default function AdminApp() {
  const { state, signIn, signOut } = useAdminAuth();

  return (
    <div className="h-screen overflow-y-auto bg-paper text-ink">
      <a href="#admin-main" className="skip-link">
        Skip to content
      </a>
      {state.phase === "admin" ? (
        <Dashboard email={state.email} signOut={signOut} />
      ) : state.phase === "loading" ? (
        <Centered>
          <PanelSkeleton label="admin dashboard" lines={3} />
        </Centered>
      ) : state.phase === "unconfigured" ? (
        <Centered>
          <Brand />
          <h1 className="mt-4 text-xl font-bold">Supabase isn&rsquo;t configured</h1>
          <p className="mt-2 text-sm">
            The dashboard reads resident feedback from Supabase. Copy <code className="rounded bg-stone-100 px-1">.env.example</code> to{" "}
            <code className="rounded bg-stone-100 px-1">.env.local</code>, fill in <code className="rounded bg-stone-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="rounded bg-stone-100 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, run the migration, then restart <code className="rounded bg-stone-100 px-1">npm run dev</code>.
          </p>
        </Centered>
      ) : state.phase === "forbidden" ? (
        <Centered>
          <Brand />
          <h1 className="mt-4 text-xl font-bold">This account isn&rsquo;t an admin</h1>
          <p className="mt-2 text-sm">
            You&rsquo;re signed in as <strong>{state.email}</strong>, but that user doesn&rsquo;t have the admin role. Run the &ldquo;make your admin user&rdquo; SQL at the bottom of the
            migration, then sign out and back in.
          </p>
          <button type="button" className={`${btnGhost} mt-4`} onClick={() => void signOut()}>
            <AIcon name="logout" size={16} /> Sign out
          </button>
        </Centered>
      ) : (
        <Centered>
          <Brand />
          <h1 className="mt-4 text-xl font-bold">Admin sign in</h1>
          <SignInForm signIn={signIn} />
        </Centered>
      )}
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <main id="admin-main" className="mx-auto flex min-h-full max-w-md items-center px-4 py-10">
      <div className={`${cardCls} w-full`}>{children}</div>
    </main>
  );
}

function Brand() {
  return (
    <p className="flex items-center gap-2.5">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line text-lg font-extrabold text-brand-strong" aria-hidden="true">
        d<span className="text-brand">0</span>
      </span>
      <span className="text-lg font-bold leading-tight">
        dayzero<span className="text-brand">.</span> <span className="font-medium text-ink-muted">Admin</span>
      </span>
    </p>
  );
}

function SignInForm({ signIn }: { signIn: (email: string, password: string) => Promise<string | null> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const failure = await signIn(email.trim(), password);
    setBusy(false);
    if (failure) setError(failure);
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="mt-3 space-y-3">
      <label className="block text-sm font-semibold">
        Email
        <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputCls} mt-1`} />
      </label>
      <label className="block text-sm font-semibold">
        Password
        <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputCls} mt-1`} />
      </label>
      {error && (
        <p role="alert" className="rounded-lg border border-bad/40 bg-bad-soft px-3 py-2 text-sm font-medium text-bad">
          {error}
        </p>
      )}
      <button type="submit" className={`${btnPrimary} w-full`} disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function Dashboard({ email, signOut }: { email: string; signOut: () => Promise<void> }) {
  const data = useAdminData();
  const [tab, setTab] = useState<Tab>("overview");
  const [request, setRequest] = useState<PlannerRequest | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<JurySuggestion | null>(null);

  const voteCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    data.votes.forEach((v) => (counts[v.option_id] = (counts[v.option_id] ?? 0) + 1));
    return counts;
  }, [data.votes]);
  const newCount = data.suggestions.filter((s) => s.status === "new").length;

  // A visible, self-dismissing heads-up whenever a resident submits something while the admin is looking.
  useEffect(() => {
    if (!data.lastArrival) return undefined;
    setToast(data.lastArrival);
    const timer = window.setTimeout(() => setToast(null), 8000);
    return () => window.clearTimeout(timer);
  }, [data.lastArrival]);

  const planSuggestion = (s: JurySuggestion) => {
    setRequest({ draft: draftFromSuggestion(s), suggestionId: s.id });
    setTab("planner");
  };
  const planDraft = (draft: Partial<ProjectDraft>) => {
    setRequest({ draft });
    setTab("planner");
  };
  const requestHandled = useCallback(() => setRequest(null), []);

  const createProject = async (draft: ProjectDraft, suggestionId?: string): Promise<string | null> => {
    const { project, error } = await data.createProject(draft);
    if (error || !project) return error ?? "Could not create the project.";
    if (suggestionId) {
      const linkError = await data.updateSuggestion(suggestionId, { project_id: project.id, status: "planned" });
      if (linkError) setNotice(`The project was created, but linking it to the suggestion failed: ${linkError}`);
    }
    return null;
  };

  const live = LIVE_COPY[data.status];
  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "feedback", label: "Feedback", badge: newCount },
    { id: "planner", label: "Planner" },
  ];

  return (
    <>
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Brand />
          <span className="hidden text-sm text-ink-muted md:inline">Bandar Bukit Raja · resident jury &amp; project planner</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <p
              role="status"
              title={data.error ?? live.detail}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${live.cls}`}
            >
              <AIcon name={live.icon} size={14} className={data.status === "connecting" ? "animate-pulse" : undefined} />
              {live.text}
              <span className="sr-only">: {live.detail}</span>
            </p>
            {(data.status === "error" || data.status === "polling") && (
              <button type="button" className={btnGhost} onClick={() => void data.refresh()}>
                <AIcon name="refresh" size={14} /> Retry
              </button>
            )}
            <span className="hidden text-xs text-ink-muted sm:inline">{email}</span>
            <button type="button" className={btnGhost} onClick={() => void signOut()}>
              <AIcon name="logout" size={16} /> Sign out
            </button>
          </div>
        </div>
        <nav aria-label="Admin sections" className="mx-auto flex max-w-7xl gap-5 px-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={tab === t.id ? "page" : undefined}
              onClick={() => setTab(t.id)}
              className={`-mb-px flex items-center gap-1.5 border-b-[3px] py-2.5 text-sm ${
                tab === t.id ? "border-brand font-bold text-brand-strong" : "border-transparent font-medium text-ink-muted hover:text-ink"
              }`}
            >
              {t.label}
              {t.badge ? (
                <span className="rounded-full bg-brand px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">
                  {t.badge}
                  <span className="sr-only"> new</span>
                </span>
              ) : null}
            </button>
          ))}
        </nav>
      </header>

      <main id="admin-main" className="mx-auto max-w-7xl space-y-4 px-4 py-6">
        {data.error && (
          <p role="alert" className="rounded-lg border border-bad/40 bg-bad-soft px-3 py-2 text-sm font-medium text-bad">
            Database problem: {data.error}
          </p>
        )}
        {notice && (
          <p role="status" className="flex items-start justify-between gap-3 rounded-lg border border-warn/40 bg-warn-soft px-3 py-2 text-sm font-medium text-warn">
            {notice}
            <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)}>
              <AIcon name="x" size={16} />
            </button>
          </p>
        )}

        {!data.loaded && !data.error && tab === "overview" ? (
          <PanelSkeleton label="overview" chart lines={4} />
        ) : tab === "overview" ? (
          <Overview
            votes={data.votes}
            suggestions={data.suggestions}
            projects={data.projects}
            voteCounts={voteCounts}
            onOpenFeedback={() => setTab("feedback")}
            onOpenPlanner={() => setTab("planner")}
            onPlanDraft={planDraft}
          />
        ) : tab === "feedback" ? (
          <FeedbackInbox
            suggestions={data.suggestions}
            projects={data.projects}
            fresh={data.fresh}
            loaded={data.loaded}
            onUpdate={data.updateSuggestion}
            onDelete={data.deleteSuggestion}
            onPlan={planSuggestion}
          />
        ) : (
          <ProjectPlanner
            projects={data.projects}
            voteCounts={voteCounts}
            request={request}
            onRequestHandled={requestHandled}
            onCreate={createProject}
            onUpdate={data.updateProject}
            onDelete={data.deleteProject}
          />
        )}
      </main>

      <p className="sr-only" role="status" aria-live="polite">
        {data.arrivals > 0 ? `${data.arrivals} new resident ${data.arrivals === 1 ? "suggestion" : "suggestions"} received since you opened this page.` : ""}
      </p>

      {toast && (
        <div role="status" className="fixed bottom-4 right-4 z-40 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-brand bg-card p-4 shadow-lg">
          <p className="flex items-center gap-1.5 text-sm font-bold text-brand-strong">
            <AIcon name="bolt" size={16} /> New resident suggestion
          </p>
          <p className="mt-1 text-xs text-ink-muted">{toast.place}</p>
          <p className="line-clamp-3 text-sm">{toast.body}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                setTab("feedback");
                setToast(null);
              }}
            >
              View
            </button>
            <button type="button" className={btnGhost} onClick={() => setToast(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}
    </>
  );
}

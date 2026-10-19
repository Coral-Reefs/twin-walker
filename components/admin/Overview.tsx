"use client";

import { useMemo } from "react";
import { options as proposals } from "@/lib/bbr/engine";
import { draftFromOption, fmtDate, timeAgo, todayISO } from "@/lib/admin/planner";
import type { JurySuggestion, JuryVote, PlannerProject, ProjectDraft } from "@/lib/admin/types";
import { fmtRM } from "@/lib/ui/format";
import { AIcon, Badge, PROJECT_STATUS, btnGhost, btnPrimary, cardCls, optionColor } from "./ui";

interface Props {
  votes: JuryVote[];
  suggestions: JurySuggestion[];
  projects: PlannerProject[];
  voteCounts: Record<string, number>;
  onOpenFeedback: () => void;
  onOpenPlanner: () => void;
  onPlanDraft: (draft: Partial<ProjectDraft>) => void;
}

function Kpi({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon: Parameters<typeof AIcon>[0]["name"] }) {
  return (
    <div className={cardCls}>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        <AIcon name={icon} size={14} /> {label}
      </p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-sm text-ink-muted">{hint}</p>}
    </div>
  );
}

export default function Overview({ votes, suggestions, projects, voteCounts, onOpenFeedback, onOpenPlanner, onPlanDraft }: Props) {
  const today = useMemo(() => todayISO(), []);
  const totalVotes = votes.length;
  const newCount = suggestions.filter((s) => s.status === "new").length;
  const active = projects.filter((p) => p.status === "in_progress").length;
  const budget = projects.reduce((n, p) => n + (p.budget_rm ?? 0), 0);

  const rows = useMemo(() => {
    const ids = [...proposals.map((o) => o.id), ...Object.keys(voteCounts).filter((id) => !proposals.some((o) => o.id === id))];
    const list = ids.map((id) => {
      const proposal = proposals.find((o) => o.id === id);
      const count = voteCounts[id] ?? 0;
      return {
        id,
        proposal,
        name: proposal?.name ?? id,
        count,
        share: totalVotes > 0 ? count / totalVotes : 0,
        project: projects.find((p) => p.option_id === id),
      };
    });
    return list.sort((a, b) => b.count - a.count);
  }, [voteCounts, totalVotes, projects]);

  const leader = totalVotes > 0 ? rows[0] : undefined;
  const upcoming = [...projects]
    .filter((p) => p.status !== "done")
    .sort((a, b) => (a.start_date < b.start_date ? -1 : 1))
    .slice(0, 4);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Votes cast" value={String(totalVotes)} hint="one editable choice per browser" icon="ballot" />
        <Kpi label="Suggestions" value={String(suggestions.length)} hint={newCount > 0 ? `${newCount} waiting for review` : "all reviewed"} icon="inbox" />
        <Kpi label="Projects" value={String(projects.length)} hint={`${active} in progress`} icon="gantt" />
        <Kpi label="Planned budget" value={budget > 0 ? fmtRM(budget) : "RM 0"} hint="sum of project budgets" icon="calendar" />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <section aria-labelledby="pref-heading" className={`${cardCls} lg:col-span-3`}>
          <h2 id="pref-heading" className="text-base font-semibold">
            What residents want first
          </h2>
          <p className="text-sm text-ink-muted" aria-live="polite">
            {leader ? (
              <>
                <strong className="text-ink">{leader.name}</strong> leads with {leader.count} of {totalVotes} {totalVotes === 1 ? "vote" : "votes"} (
                {Math.round(leader.share * 100)}%).
              </>
            ) : (
              "No votes yet. They will appear here the moment a resident chooses a proposal."
            )}
          </p>

          <ul className="mt-3 space-y-3">
            {rows.map((r) => (
              <li key={r.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-semibold">{r.name}</span>
                  <span className="text-sm tabular-nums text-ink-muted">
                    {r.count} {r.count === 1 ? "vote" : "votes"} · {Math.round(r.share * 100)}%
                    {r.proposal ? ` · ${fmtRM(r.proposal.cost)}` : ""}
                  </span>
                </div>
                <div className="mt-1 h-3 overflow-hidden rounded-full bg-stone-100" role="presentation">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(r.share * 100, r.count > 0 ? 2 : 0)}%`, backgroundColor: optionColor(r.id) }} />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {r.project ? (
                    <>
                      <Badge cls={PROJECT_STATUS[r.project.status].cls} icon={PROJECT_STATUS[r.project.status].icon}>
                        {PROJECT_STATUS[r.project.status].label}
                      </Badge>
                      <span className="text-xs text-ink-muted">
                        {fmtDate(r.project.start_date)} – {fmtDate(r.project.end_date)}
                      </span>
                    </>
                  ) : (
                    r.proposal && (
                      <button type="button" className={btnGhost} onClick={() => onPlanDraft(draftFromOption(r.proposal!, today))}>
                        <AIcon name="plus" size={14} /> Plan this proposal
                      </button>
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-5 lg:col-span-2">
          <section aria-labelledby="latest-heading" className={cardCls}>
            <div className="flex items-center justify-between gap-2">
              <h2 id="latest-heading" className="text-base font-semibold">
                Latest suggestions
              </h2>
              <button type="button" className={btnGhost} onClick={onOpenFeedback}>
                Open inbox
              </button>
            </div>
            {suggestions.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">Nothing yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {suggestions.slice(0, 4).map((s) => (
                  <li key={s.id} className="py-2">
                    <p className="text-xs text-ink-muted">
                      {s.place} · {timeAgo(s.created_at)}
                    </p>
                    <p className="line-clamp-2 text-sm">{s.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="next-heading" className={cardCls}>
            <div className="flex items-center justify-between gap-2">
              <h2 id="next-heading" className="text-base font-semibold">
                Coming up
              </h2>
              <button type="button" className={btnPrimary} onClick={onOpenPlanner}>
                <AIcon name="gantt" size={16} /> Open planner
              </button>
            </div>
            {upcoming.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">No projects yet. Start from a proposal on the left.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {upcoming.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 py-2">
                    <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: optionColor(p.option_id) }} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{p.title}</span>
                      <span className="block text-xs text-ink-muted">
                        {fmtDate(p.start_date)} – {fmtDate(p.end_date)} · {PROJECT_STATUS[p.status].label}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

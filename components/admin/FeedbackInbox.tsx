"use client";

import { useEffect, useMemo, useState } from "react";
import { PanelSkeleton } from "@/components/system/Skeleton";
import { fmtDate, timeAgo } from "@/lib/admin/planner";
import {
  SUGGESTION_STATUSES,
  type JurySuggestion,
  type PlannerProject,
  type SuggestionPatch,
  type SuggestionStatus,
} from "@/lib/admin/types";
import { AIcon, Badge, SUGGESTION_STATUS, btnDanger, btnGhost, btnPrimary, cardCls, inputCls } from "./ui";

interface Props {
  suggestions: JurySuggestion[];
  projects: PlannerProject[];
  fresh: ReadonlySet<string>;
  loaded: boolean;
  onUpdate: (id: string, patch: SuggestionPatch) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
  onPlan: (s: JurySuggestion) => void;
}

type Filter = "all" | SuggestionStatus;

/** Spreadsheet apps run text starting with = + - @ as a formula; neutralise that for resident-written text. */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function exportCsv(rows: JurySuggestion[], projectTitle: (id: string | null) => string) {
  const header = ["Received", "Place", "Suggestion", "Status", "Admin note", "Linked project"];
  const lines = rows.map((s) =>
    [s.created_at, s.place, s.body, s.status, s.admin_note ?? "", projectTitle(s.project_id)].map(csvCell).join(","),
  );
  const blob = new Blob([`${[header.map(csvCell).join(","), ...lines].join("\r\n")}\r\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `resident-suggestions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FeedbackInbox({ suggestions, projects, fresh, loaded, onUpdate, onDelete, onPlan }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [place, setPlace] = useState("");
  const [query, setQuery] = useState("");

  const places = useMemo(() => [...new Set(suggestions.map((s) => s.place))].sort((a, b) => a.localeCompare(b)), [suggestions]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: suggestions.length, new: 0, reviewing: 0, planned: 0, declined: 0 };
    suggestions.forEach((s) => (c[s.status] += 1));
    return c;
  }, [suggestions]);
  const projectTitle = (id: string | null) => (id ? (projects.find((p) => p.id === id)?.title ?? "") : "");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return suggestions.filter(
      (s) =>
        (filter === "all" || s.status === filter) &&
        (!place || s.place === place) &&
        (!q || s.body.toLowerCase().includes(q) || s.place.toLowerCase().includes(q) || (s.admin_note ?? "").toLowerCase().includes(q)),
    );
  }, [suggestions, filter, place, query]);

  if (!loaded) return <PanelSkeleton label="feedback" lines={5} />;

  return (
    <section aria-labelledby="inbox-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="inbox-heading" className="text-xl font-bold">
            Resident feedback
          </h2>
          <p className="text-sm text-ink-muted">
            Suggestions written in the Resident Jury appear here as soon as they are submitted. Residents&rsquo; text can&rsquo;t be edited, only triaged.
          </p>
        </div>
        <button type="button" className={btnGhost} onClick={() => exportCsv(shown, projectTitle)} disabled={shown.length === 0}>
          <AIcon name="download" size={16} /> Export CSV ({shown.length})
        </button>
      </div>

      <div className={`${cardCls} flex flex-wrap items-center gap-2`}>
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {(["all", ...SUGGESTION_STATUSES] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                filter === f ? "border-brand bg-brand text-white" : "border-line bg-white text-ink hover:bg-stone-50"
              }`}
            >
              {f === "all" ? "All" : SUGGESTION_STATUS[f].label} · {counts[f]}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className="sr-only">Filter by place</span>
          <select value={place} onChange={(e) => setPlace(e.target.value)} className={`${inputCls} w-auto`}>
            <option value="">All places</option>
            {places.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="relative">
          <span className="sr-only">Search suggestions</span>
          <AIcon name="search" size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className={`${inputCls} w-48 pl-8`} />
        </label>
      </div>

      {shown.length === 0 ? (
        <div className={`${cardCls} text-center`}>
          <AIcon name="inbox" size={28} className="mx-auto text-ink-muted" />
          <p className="mt-2 font-semibold">{suggestions.length === 0 ? "No resident suggestions yet" : "Nothing matches these filters"}</p>
          <p className="text-sm text-ink-muted">
            {suggestions.length === 0
              ? "When a resident saves a suggestion in the Resident Jury, it will show up here automatically."
              : "Try a different status, place or search term."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((s) => (
            <SuggestionCard
              key={s.id}
              s={s}
              isFresh={fresh.has(s.id)}
              projectTitle={projectTitle(s.project_id)}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onPlan={onPlan}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function SuggestionCard({
  s,
  isFresh,
  projectTitle,
  onUpdate,
  onDelete,
  onPlan,
}: {
  s: JurySuggestion;
  isFresh: boolean;
  projectTitle: string;
  onUpdate: Props["onUpdate"];
  onDelete: Props["onDelete"];
  onPlan: Props["onPlan"];
}) {
  const [note, setNote] = useState(s.admin_note ?? "");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setNote(s.admin_note ?? ""), [s.admin_note]);

  const run = async (job: Promise<string | null>) => setError(await job);
  const meta = SUGGESTION_STATUS[s.status];

  return (
    <li className={`${cardCls} transition-shadow ${isFresh ? "ring-2 ring-brand" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge cls={meta.cls} icon={meta.icon}>
          {meta.label}
        </Badge>
        {isFresh && (
          <Badge cls="bg-brand text-white" icon="bolt">
            Just in
          </Badge>
        )}
        <span className="text-sm font-semibold">{s.place}</span>
        <span className="text-xs text-ink-muted" title={new Date(s.created_at).toLocaleString()}>
          · {timeAgo(s.created_at)} · {fmtDate(s.created_at)}
        </span>
      </div>

      <p className="mt-2 whitespace-pre-wrap text-base">{s.body}</p>

      <div className="mt-3 grid gap-3 md:grid-cols-[12rem_1fr]">
        <label className="text-sm font-semibold">
          Status
          <select
            value={s.status}
            onChange={(e) => void run(onUpdate(s.id, { status: e.target.value as SuggestionStatus }))}
            className={`${inputCls} mt-1`}
          >
            {SUGGESTION_STATUSES.map((st) => (
              <option key={st} value={st}>
                {SUGGESTION_STATUS[st].label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Internal note <span className="font-normal text-ink-muted">(never shown to residents)</span>
          <textarea
            value={note}
            maxLength={1000}
            rows={2}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              const next = note.trim();
              if (next !== (s.admin_note ?? "")) void run(onUpdate(s.id, { admin_note: next || null }));
            }}
            className={`${inputCls} mt-1`}
            placeholder="Context, owner, follow-up…"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {s.project_id ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-ink">
            <AIcon name="link" size={16} className="text-brand" />
            Linked to project <strong>{projectTitle || "(deleted)"}</strong>
          </span>
        ) : (
          <button type="button" className={btnPrimary} onClick={() => onPlan(s)}>
            <AIcon name="gantt" size={16} /> Plan this
          </button>
        )}
        <button
          type="button"
          className={`${btnDanger} ml-auto`}
          onClick={() => {
            if (window.confirm("Delete this suggestion permanently?")) void run(onDelete(s.id));
          }}
        >
          <AIcon name="trash" size={16} /> Delete
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-bad">
          {error}
        </p>
      )}
    </li>
  );
}

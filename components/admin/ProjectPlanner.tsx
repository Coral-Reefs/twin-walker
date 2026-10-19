"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { options as proposals } from "@/lib/bbr/engine";
import {
  ZOOMS,
  applyDrag,
  barGeometry,
  dateTicks,
  defaultProjectDates,
  dependencyConflicts,
  draftFromOption,
  fmtDate,
  monthSegments,
  timelineRange,
  todayISO,
  toDay,
  wouldCreateCycle,
  type DragMode,
  type ZoomId,
} from "@/lib/admin/planner";
import { PROJECT_STATUSES, type PlannerProject, type PlannerRequest, type ProjectDraft, type ProjectStatus } from "@/lib/admin/types";
import { fmtRM } from "@/lib/ui/format";
import { AIcon, Badge, CUSTOM_COLOR, PROJECT_STATUS, btnDanger, btnGhost, btnPrimary, cardCls, inputCls, optionColor } from "./ui";

const ROW_H = 52;
const BAR_H = 28;
const LEFT_W = 288;
const MONTH_H = 26;
const TICK_H = 28;
const HEAD_H = MONTH_H + TICK_H;

const STRIPES = "repeating-linear-gradient(135deg, rgba(185,28,28,0.28) 0 6px, transparent 6px 12px)";

interface Props {
  projects: PlannerProject[];
  voteCounts: Record<string, number>;
  request: PlannerRequest | null;
  onRequestHandled: () => void;
  onCreate: (draft: ProjectDraft, suggestionId?: string) => Promise<string | null>;
  onUpdate: (id: string, patch: Partial<ProjectDraft>) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
}

interface Editing {
  project: PlannerProject | null;
  draft: Partial<ProjectDraft>;
  suggestionId?: string;
}

type Dates = { start_date: string; end_date: string };

export default function ProjectPlanner({ projects, voteCounts, request, onRequestHandled, onCreate, onUpdate, onDelete }: Props) {
  const [zoom, setZoom] = useState<ZoomId>("weeks");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [draft, setDraft] = useState<Record<string, Dates>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [live, setLive] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  const today = useMemo(() => todayISO(), []);
  const px = (ZOOMS.find((z) => z.id === zoom) ?? ZOOMS[1]).px;

  // Open the editor when the overview / inbox sends a pre-filled project.
  useEffect(() => {
    if (!request) return;
    setEditing({ project: null, draft: request.draft, suggestionId: request.suggestionId });
    onRequestHandled();
  }, [request, onRequestHandled]);

  // Rows show live drag positions; the visible range is computed from saved data so it doesn't shift mid-drag.
  const rows = useMemo(() => projects.map((p) => (draft[p.id] ? { ...p, ...draft[p.id] } : p)), [projects, draft]);
  const byId = useMemo(() => new Map(rows.map((p) => [p.id, p])), [rows]);
  const range = useMemo(() => timelineRange(projects, today), [projects, today]);
  const months = useMemo(() => monthSegments(range, px), [range, px]);
  const ticks = useMemo(() => dateTicks(range, px), [range, px]);
  const width = (range.endDay - range.startDay + 1) * px;
  const todayX = (toDay(today) - range.startDay) * px;

  const scrollToToday = () => {
    const el = scroller.current;
    if (el) el.scrollLeft = Math.max(0, todayX - 80);
  };
  useEffect(scrollToToday, [zoom]);

  const commit = async (id: string, patch: Partial<ProjectDraft>) => {
    const error = await onUpdate(id, patch);
    if (error) setBanner(`Couldn't save the change: ${error}`);
    else setBanner(null);
  };

  // ----- mouse / touch drag (listeners live on window so fast drags never lose the bar) -----
  const beginDrag = (e: ReactPointerEvent, p: PlannerProject, mode: DragMode) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const orig: Dates = { start_date: p.start_date, end_date: p.end_date };
    let moved = false;
    const delta = (ev: PointerEvent) => Math.round((ev.clientX - startX) / px);

    const onMove = (ev: PointerEvent) => {
      const d = delta(ev);
      if (d !== 0) moved = true;
      if (moved) setDraft((prev) => ({ ...prev, [p.id]: applyDrag(orig, mode, d) }));
    };
    const finish = (ev: PointerEvent, save: boolean) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      const next = applyDrag(orig, mode, delta(ev));
      if (save && moved && (next.start_date !== orig.start_date || next.end_date !== orig.end_date)) {
        void commit(p.id, next); // optimistic update runs synchronously, so the bar doesn't flicker back
        setLive(`${p.title}: ${fmtDate(next.start_date)} to ${fmtDate(next.end_date)}`);
      } else if (save && !moved) {
        setEditing({ project: p, draft: {} });
      }
      setDraft((prev) => {
        const rest = { ...prev };
        delete rest[p.id];
        return rest;
      });
    };
    const onUp = (ev: PointerEvent) => finish(ev, true);
    const onCancel = (ev: PointerEvent) => finish(ev, false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  };

  // ----- keyboard: arrows move a day (Alt = a week); Shift+arrows change the end date; Enter edits -----
  const onBarKey = (e: KeyboardEvent<HTMLDivElement>, p: PlannerProject) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setEditing({ project: p, draft: {} });
      return;
    }
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const step = (e.key === "ArrowLeft" ? -1 : 1) * (e.altKey ? 7 : 1);
    const next = applyDrag(p, e.shiftKey ? "end" : "move", step);
    void commit(p.id, next);
    setLive(`${p.title}: ${fmtDate(next.start_date)} to ${fmtDate(next.end_date)}`);
  };

  // ----- dependency arrows -----
  const index = useMemo(() => new Map(rows.map((p, i) => [p.id, i])), [rows]);
  const links = rows.flatMap((p, i) =>
    p.depends_on.flatMap((depId) => {
      const j = index.get(depId);
      const pred = j === undefined ? undefined : rows[j];
      if (j === undefined || !pred) return [];
      const a = barGeometry(pred, range, px);
      const b = barGeometry(p, range, px);
      return [
        {
          key: `${depId}>${p.id}`,
          x1: a.left + a.width,
          y1: j * ROW_H + ROW_H / 2,
          x2: b.left,
          y2: i * ROW_H + ROW_H / 2,
          conflict: toDay(p.start_date) <= toDay(pred.end_date),
        },
      ];
    }),
  );

  const linkPath = (l: { x1: number; y1: number; x2: number; y2: number }) => {
    if (l.x2 >= l.x1 + 16) return `M${l.x1} ${l.y1} H${l.x1 + 8} V${l.y2} H${l.x2}`;
    const ym = l.y1 + (l.y2 >= l.y1 ? 1 : -1) * (ROW_H / 2);
    return `M${l.x1} ${l.y1} H${l.x1 + 8} V${ym} H${l.x2 - 8} V${l.y2} H${l.x2}`;
  };

  const unplanned = proposals.filter((o) => !projects.some((p) => p.option_id === o.id));
  const totalBudget = projects.reduce((n, p) => n + (p.budget_rm ?? 0), 0);
  const avgProgress = projects.length ? Math.round(projects.reduce((n, p) => n + p.progress, 0) / projects.length) : 0;
  const conflictCount = rows.filter((p) => dependencyConflicts(p, byId).length > 0).length;

  const save = async (values: ProjectDraft): Promise<string | null> => {
    if (editing?.project) return onUpdate(editing.project.id, values);
    return onCreate(values, editing?.suggestionId);
  };

  return (
    <section aria-labelledby="planner-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="planner-heading" className="text-xl font-bold">
            Project planner
          </h2>
          <p className="text-sm text-ink-muted">
            Drag a bar to reschedule, drag its edges to change the length, or focus a bar and use the arrow keys (Shift = end date, Alt = one week). Press Enter to edit.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Timeline zoom" className="inline-flex overflow-hidden rounded-lg border border-line bg-white">
            {ZOOMS.map((z) => (
              <button
                key={z.id}
                type="button"
                aria-pressed={zoom === z.id}
                onClick={() => setZoom(z.id)}
                className={`px-3 py-2 text-sm font-semibold ${zoom === z.id ? "bg-brand text-white" : "text-ink hover:bg-stone-50"}`}
              >
                {z.label}
              </button>
            ))}
          </div>
          <button type="button" className={btnGhost} onClick={scrollToToday}>
            <AIcon name="calendar" size={16} /> Today
          </button>
          <button type="button" className={btnPrimary} onClick={() => setEditing({ project: null, draft: {} })}>
            <AIcon name="plus" size={16} /> New project
          </button>
        </div>
      </div>

      {unplanned.length > 0 && (
        <div className={`${cardCls} flex flex-wrap items-center gap-2`}>
          <span className="text-sm font-semibold">Start from a resident proposal:</span>
          {unplanned.map((o) => (
            <button key={o.id} type="button" className={btnGhost} onClick={() => setEditing({ project: null, draft: draftFromOption(o, today) })}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: optionColor(o.id) }} aria-hidden="true" />
              {o.name}
              <span className="font-normal text-ink-muted">
                · {voteCounts[o.id] ?? 0} {(voteCounts[o.id] ?? 0) === 1 ? "vote" : "votes"}
              </span>
            </button>
          ))}
        </div>
      )}

      {banner && (
        <p role="alert" className="rounded-lg border border-bad/40 bg-bad-soft px-3 py-2 text-sm font-medium text-bad">
          {banner}
        </p>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {live}
      </p>

      <div className="flex flex-wrap gap-2 text-sm">
        <Badge cls="bg-stone-100 text-ink">{projects.length} {projects.length === 1 ? "project" : "projects"}</Badge>
        <Badge cls="bg-stone-100 text-ink">{totalBudget > 0 ? fmtRM(totalBudget) : "RM 0"} budgeted</Badge>
        <Badge cls="bg-stone-100 text-ink">{avgProgress}% average progress</Badge>
        {conflictCount > 0 && (
          <Badge cls="bg-warn-soft text-warn" icon="warning">
            {conflictCount} schedule {conflictCount === 1 ? "conflict" : "conflicts"}
          </Badge>
        )}
      </div>

      {projects.length === 0 ? (
        <div className={`${cardCls} text-center`}>
          <AIcon name="gantt" size={30} className="mx-auto text-ink-muted" />
          <p className="mt-2 font-semibold">No projects yet</p>
          <p className="text-sm text-ink-muted">Start from a resident proposal above, or create a custom project.</p>
        </div>
      ) : (
        <div ref={scroller} className="relative max-h-[68vh] overflow-auto rounded-2xl border border-line bg-card shadow-sm">
          <div className="relative" style={{ width: LEFT_W + width }}>
            {/* header */}
            <div className="sticky top-0 z-20 flex border-b border-line bg-card">
              <div
                className="sticky left-0 z-30 flex shrink-0 items-end border-r border-line bg-card px-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted"
                style={{ width: LEFT_W, height: HEAD_H }}
              >
                Project
              </div>
              <div className="relative shrink-0" style={{ width, height: HEAD_H }}>
                {months.map((m) => (
                  <div
                    key={`${m.label}-${m.left}`}
                    className="absolute top-0 overflow-hidden whitespace-nowrap border-l border-line px-2 text-xs font-bold leading-[26px] text-ink"
                    style={{ left: m.left, width: m.width, height: MONTH_H }}
                  >
                    {m.label}
                  </div>
                ))}
                {ticks.map((t) =>
                  t.label ? (
                    <div
                      key={t.left}
                      className={`absolute text-[11px] leading-[28px] text-ink-muted ${px >= 28 ? "text-center" : "pl-1"} ${t.weekend ? "font-semibold" : ""}`}
                      style={{ left: t.left, width: px >= 28 ? px : px * 7, top: MONTH_H, height: TICK_H }}
                    >
                      {t.label}
                    </div>
                  ) : null,
                )}
                <div className="absolute top-0 w-0.5 bg-bad" style={{ left: todayX + px / 2, height: HEAD_H }} aria-hidden="true" />
              </div>
            </div>

            {/* body */}
            <div className="flex">
              <div className="sticky left-0 z-10 shrink-0 border-r border-line bg-card" style={{ width: LEFT_W }}>
                {rows.map((p) => {
                  const conflicts = dependencyConflicts(p, byId);
                  const meta = PROJECT_STATUS[p.status];
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setEditing({ project: projects.find((x) => x.id === p.id) ?? null, draft: {} })}
                      className="flex w-full items-center gap-2 border-b border-line px-3 text-left hover:bg-stone-50"
                      style={{ height: ROW_H }}
                    >
                      <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: optionColor(p.option_id) }} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{p.title}</span>
                        <span className="block truncate text-xs text-ink-muted">
                          {fmtDate(p.start_date)} – {fmtDate(p.end_date)} · {meta.label} · {p.progress}%
                        </span>
                      </span>
                      {conflicts.length > 0 && (
                        <span title={`Starts before ${conflicts.map((c) => c.title).join(", ")} has finished`}>
                          <AIcon name="warning" size={18} className="text-warn" />
                          <span className="sr-only">Starts before {conflicts.map((c) => c.title).join(", ")} has finished</span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="relative shrink-0" style={{ width, height: rows.length * ROW_H }}>
                {/* grid */}
                {ticks.map((t) => (
                  <div
                    key={`g${t.left}`}
                    className={`absolute inset-y-0 ${t.weekend ? "bg-stone-100/70" : ""} border-l border-line/60`}
                    style={{ left: t.left, width: px >= 28 ? px : undefined }}
                    aria-hidden="true"
                  />
                ))}
                {rows.map((p, i) => (
                  <div key={`r${p.id}`} className="absolute inset-x-0 border-b border-line" style={{ top: i * ROW_H, height: ROW_H }} aria-hidden="true" />
                ))}
                <div className="absolute inset-y-0 w-0.5 bg-bad/70" style={{ left: todayX + px / 2 }} aria-hidden="true" />

                {/* dependency arrows */}
                <svg className="pointer-events-none absolute left-0 top-0" width={width} height={rows.length * ROW_H} aria-hidden="true">
                  <defs>
                    <marker id="dep-ok" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                      <path d="M0 0L7 3.5L0 7z" fill="#57534e" />
                    </marker>
                    <marker id="dep-bad" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                      <path d="M0 0L7 3.5L0 7z" fill="#a14400" />
                    </marker>
                  </defs>
                  {links.map((l) => (
                    <path
                      key={l.key}
                      d={linkPath(l)}
                      fill="none"
                      stroke={l.conflict ? "#a14400" : "#57534e"}
                      strokeWidth={1.5}
                      strokeDasharray={l.conflict ? "5 3" : undefined}
                      markerEnd={`url(#${l.conflict ? "dep-bad" : "dep-ok"})`}
                    />
                  ))}
                </svg>

                {/* bars */}
                {rows.map((p, i) => {
                  const g = barGeometry(p, range, px);
                  const color = optionColor(p.option_id);
                  const meta = PROJECT_STATUS[p.status];
                  const saved = projects.find((x) => x.id === p.id);
                  if (!saved) return null;
                  return (
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${p.title}, ${fmtDate(p.start_date)} to ${fmtDate(p.end_date)}, ${meta.label}, ${p.progress}% complete. Arrow keys move it, Enter edits.`}
                      onKeyDown={(e) => onBarKey(e, saved)}
                      onPointerDown={(e) => beginDrag(e, saved, "move")}
                      className="absolute cursor-grab touch-none select-none overflow-hidden rounded-md border-2 text-xs font-semibold text-ink shadow-sm active:cursor-grabbing"
                      style={{
                        left: g.left,
                        width: Math.max(g.width, 10),
                        top: i * ROW_H + (ROW_H - BAR_H) / 2,
                        height: BAR_H,
                        borderColor: color,
                        backgroundColor: `${color}26`,
                        backgroundImage: p.status === "blocked" ? STRIPES : undefined,
                      }}
                    >
                      <div className="absolute inset-y-0 left-0" style={{ width: `${p.progress}%`, backgroundColor: `${color}66` }} aria-hidden="true" />
                      <div className="relative flex h-full items-center gap-1 px-2.5">
                        <AIcon name={meta.icon} size={13} />
                        <span className="truncate">{p.title}</span>
                      </div>
                      <span
                        className="absolute inset-y-0 left-0 w-2 cursor-ew-resize"
                        onPointerDown={(e) => beginDrag(e, saved, "start")}
                        aria-hidden="true"
                      />
                      <span
                        className="absolute inset-y-0 right-0 w-2 cursor-ew-resize"
                        onPointerDown={(e) => beginDrag(e, saved, "end")}
                        aria-hidden="true"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted" aria-label="Legend">
        {proposals.map((o) => (
          <li key={o.id} className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: optionColor(o.id) }} aria-hidden="true" /> {o.name}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: CUSTOM_COLOR }} aria-hidden="true" /> Custom project
        </li>
        <li className="inline-flex items-center gap-1.5">
          <AIcon name="warning" size={13} className="text-warn" /> Blocked (striped) or schedule conflict
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 bg-ink-muted" aria-hidden="true" /> Must finish before the next starts
        </li>
      </ul>

      {editing && (
        <ProjectEditor
          key={editing.project?.id ?? "new"}
          project={editing.project}
          draft={editing.draft}
          others={projects.filter((p) => p.id !== editing.project?.id)}
          allProjects={projects}
          voteCounts={voteCounts}
          onClose={() => setEditing(null)}
          onSave={save}
          onDelete={async () => {
            if (!editing.project) return null;
            const error = await onDelete(editing.project.id);
            if (!error) setEditing(null);
            return error;
          }}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Editor dialog (native <dialog>: focus trap, Esc to close and a backdrop for free)
// ---------------------------------------------------------------------------

function blankDraft(): ProjectDraft {
  const { start, end } = defaultProjectDates();
  return {
    title: "",
    description: "",
    option_id: null,
    start_date: start,
    end_date: end,
    status: "planned",
    progress: 0,
    budget_rm: null,
    owner: null,
    depends_on: [],
    sort_order: 0,
  };
}

/** The editable fields only, so id / created_at / updated_at are never written back. */
function pickDraft(p: PlannerProject): ProjectDraft {
  const { id: _id, created_at: _created, updated_at: _updated, ...rest } = p;
  return rest;
}

function ProjectEditor({
  project,
  draft,
  others,
  allProjects,
  voteCounts,
  onClose,
  onSave,
  onDelete,
}: {
  project: PlannerProject | null;
  draft: Partial<ProjectDraft>;
  others: PlannerProject[];
  allProjects: PlannerProject[];
  voteCounts: Record<string, number>;
  onClose: () => void;
  onSave: (values: ProjectDraft) => Promise<string | null>;
  onDelete: () => Promise<string | null>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);
  const [form, setForm] = useState<ProjectDraft>(() => ({ ...blankDraft(), ...(project ? pickDraft(project) : {}), ...draft }));
  const [budget, setBudget] = useState(() => (form.budget_rm === null ? "" : String(form.budget_rm)));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
  }, []);

  const set = <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) => setForm((f) => ({ ...f, [key]: value }));

  const pickProposal = (id: string) => {
    const proposal = proposals.find((o) => o.id === id);
    setForm((f) => ({ ...f, option_id: id || null, title: f.title || (proposal?.name ?? ""), description: f.description || (proposal?.description ?? "") }));
    if (proposal && budget.trim() === "") setBudget(String(proposal.cost));
  };

  const toggleDep = (id: string) =>
    set("depends_on", form.depends_on.includes(id) ? form.depends_on.filter((d) => d !== id) : [...form.depends_on, id]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) return setError("Give the project a title.");
    if (!form.start_date || !form.end_date) return setError("Choose a start and an end date.");
    if (form.end_date < form.start_date) return setError("The end date can't be before the start date.");
    const budgetValue = budget.trim() === "" ? null : Number(budget);
    if (budgetValue !== null && (!Number.isFinite(budgetValue) || budgetValue < 0)) return setError("Budget must be zero or more.");
    if (project && wouldCreateCycle(allProjects, project.id, form.depends_on)) return setError("Those dependencies would create a loop.");

    setBusy(true);
    setError(null);
    const failure = await onSave({
      ...form,
      title,
      description: form.description.trim(),
      owner: form.owner?.trim() || null,
      budget_rm: budgetValue,
      depends_on: form.depends_on.filter((id) => others.some((o) => o.id === id)),
      progress: form.status === "done" ? 100 : form.progress,
    });
    setBusy(false);
    if (failure) setError(failure);
    else ref.current?.close();
  };

  const proposal = proposals.find((o) => o.id === form.option_id);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onMouseDown={(e) => {
        pressedBackdrop.current = e.target === ref.current;
      }}
      onClick={(e) => {
        // Close only when the press and the release both landed on the backdrop.
        if (pressedBackdrop.current && e.target === ref.current) ref.current?.close();
        pressedBackdrop.current = false;
      }}
      aria-labelledby="editor-title"
      className="m-auto max-h-[92vh] w-[min(92vw,42rem)] overflow-y-auto rounded-2xl border border-line bg-card p-0 text-ink shadow-xl backdrop:bg-ink/50"
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 id="editor-title" className="text-lg font-bold">
            {project ? "Edit project" : "New project"}
          </h3>
          <button type="button" className={btnGhost} onClick={() => ref.current?.close()} aria-label="Close">
            <AIcon name="x" size={16} />
          </button>
        </div>

        <label className="block text-sm font-semibold">
          Title
          <input className={`${inputCls} mt-1`} value={form.title} maxLength={120} onChange={(e) => set("title", e.target.value)} required />
        </label>

        <label className="block text-sm font-semibold">
          Resident proposal this delivers
          <select className={`${inputCls} mt-1`} value={form.option_id ?? ""} onChange={(e) => pickProposal(e.target.value)}>
            <option value="">Custom project (not tied to a proposal)</option>
            {proposals.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} · {voteCounts[o.id] ?? 0} {(voteCounts[o.id] ?? 0) === 1 ? "vote" : "votes"}
              </option>
            ))}
          </select>
          {proposal && <span className="mt-1 block text-xs font-normal text-ink-muted">Assumed cost: {fmtRM(proposal.cost)}. {proposal.description}</span>}
        </label>

        <label className="block text-sm font-semibold">
          Description
          <textarea className={`${inputCls} mt-1`} rows={3} maxLength={2000} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Start
            <input type="date" className={`${inputCls} mt-1`} value={form.start_date} onChange={(e) => set("start_date", e.target.value)} required />
          </label>
          <label className="text-sm font-semibold">
            End
            <input type="date" className={`${inputCls} mt-1`} value={form.end_date} min={form.start_date} onChange={(e) => set("end_date", e.target.value)} required />
          </label>
          <label className="text-sm font-semibold">
            Status
            <select className={`${inputCls} mt-1`} value={form.status} onChange={(e) => set("status", e.target.value as ProjectStatus)}>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS[s].label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Progress: {form.status === "done" ? 100 : form.progress}%
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              disabled={form.status === "done"}
              className="mt-2 w-full accent-brand"
              value={form.status === "done" ? 100 : form.progress}
              onChange={(e) => set("progress", Number(e.target.value))}
            />
          </label>
          <label className="text-sm font-semibold">
            Budget (RM)
            <input inputMode="decimal" className={`${inputCls} mt-1`} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 45000" />
          </label>
          <label className="text-sm font-semibold">
            Owner
            <input className={`${inputCls} mt-1`} value={form.owner ?? ""} maxLength={80} onChange={(e) => set("owner", e.target.value)} placeholder="Person or team" />
          </label>
        </div>

        {others.length > 0 && (
          <fieldset className="rounded-lg border border-line p-3">
            <legend className="px-1 text-sm font-semibold">Can only start after these finish</legend>
            <div className="max-h-40 space-y-1.5 overflow-y-auto">
              {others.map((o) => (
                <label key={o.id} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1 accent-brand" checked={form.depends_on.includes(o.id)} onChange={() => toggleDep(o.id)} />
                  <span>
                    <span className="font-medium">{o.title}</span>
                    <span className="block text-xs text-ink-muted">
                      ends {fmtDate(o.end_date)} · {PROJECT_STATUS[o.status].label}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {error && (
          <p role="alert" className="rounded-lg border border-bad/40 bg-bad-soft px-3 py-2 text-sm font-medium text-bad">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <button type="submit" className={btnPrimary} disabled={busy}>
            <AIcon name="check" size={16} /> {busy ? "Saving…" : project ? "Save changes" : "Create project"}
          </button>
          <button type="button" className={btnGhost} onClick={() => ref.current?.close()}>
            Cancel
          </button>
          {project && (
            <button
              type="button"
              className={`${btnDanger} ml-auto`}
              disabled={busy}
              onClick={async () => {
                if (!window.confirm(`Delete "${project.title}"? Linked suggestions stay in the inbox.`)) return;
                setBusy(true);
                const failure = await onDelete();
                setBusy(false);
                if (failure) setError(failure);
              }}
            >
              <AIcon name="trash" size={16} /> Delete
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}

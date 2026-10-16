import { Icon } from "@/components/system/Icon";
import type { DayResult, Persona } from "@/lib/simulation/types";
import { PERIOD_LABEL, fmtDistance } from "@/lib/ui/format";
import { BARRIER_STYLE } from "@/lib/ui/styles";
import { numberBarriers } from "./mapGeometry";

/** Text alternative for the map: every journey and every barrier, in words. */
export function KeyFindings({ persona, day }: { persona: Persona; day: DayResult }) {
  const barriers = numberBarriers(day);
  const longestWait = day.legs
    .flatMap((l) => [
      ...l.steps.filter((s) => s.waitMin > 0).map((s) => ({ min: s.waitMin, where: s.waitLabel ?? "a crossing" })),
      ...(l.queueWaitMin > 0 ? [{ min: l.queueWaitMin, where: `the queue at ${l.toLabel}` }] : []),
    ])
    .sort((a, b) => b.min - a.min)[0];

  return (
    <section aria-labelledby="findings-heading" className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <h2 id="findings-heading" className="flex items-center gap-2 text-base font-semibold">
        <Icon name="list" size={18} /> What the map shows
      </h2>
      <p className="mt-1 text-sm text-ink">
        {persona.name} makes {day.legs.length} journeys covering {fmtDistance(day.totals.distanceM)}, spending{" "}
        {day.totals.minutes.toFixed(1)} minutes travelling and waiting.
        {longestWait && ` Longest wait: ${longestWait.min.toFixed(1)} min at ${longestWait.where}.`}
      </p>

      <h3 className="mt-3 text-sm font-semibold">Journeys</h3>
      <ol className="mt-1 space-y-1.5 text-sm">
        {day.legs.map((leg) => (
          <li key={leg.index} className="flex gap-2">
            <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-stone-200 px-1 text-xs font-bold">
              {leg.index + 1}
            </span>
            <span>
              <span className="font-medium">
                {leg.fromLabel} → {leg.toLabel}
              </span>
              <span className="text-ink-muted">
                {" "}
                · {PERIOD_LABEL[leg.period]} · {fmtDistance(leg.distanceM)} · {leg.totalMin.toFixed(1)} min
                {leg.crossingWaitMin + leg.queueWaitMin > 0 && ` (incl. ${(leg.crossingWaitMin + leg.queueWaitMin).toFixed(1)} min waiting)`}
                {!leg.reachable && " · no step-free route"}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <h3 className="mt-3 text-sm font-semibold">Barriers (numbered as on the map)</h3>
      {barriers.length === 0 ? (
        <p className="mt-1 flex items-center gap-2 text-sm font-medium text-good">
          <Icon name="check" size={16} strokeWidth={3} /> No barriers on this route.
        </p>
      ) : (
        <ol className="mt-1 space-y-1.5 text-sm">
          {barriers.map((b) => {
            const s = BARRIER_STYLE[b.type];
            return (
              <li key={`${b.type}-${b.n}`} className="flex gap-2">
                <span
                  className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-white"
                  style={{ background: s.color }}
                >
                  <Icon name={s.icon} size={13} strokeWidth={2.6} />
                </span>
                <span>
                  <span className="font-semibold">
                    {b.n}. {s.label}
                  </span>{" "}
                  <span className="text-ink-muted">(journey {b.legIndex + 1})</span> — {b.detail}
                  {b.type === "no-seating" && ` · ${b.extraMin.toFixed(1)} min resting`}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

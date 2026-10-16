"use client";

import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/system/Icon";
import type { DayResult, Persona } from "@/lib/simulation/types";
import { fmtDistance } from "@/lib/ui/format";
import { CountUp } from "./CountUp";

interface Props {
  persona: Persona;
  day: DayResult;
  baselineDay: DayResult;
  compare: boolean;
}

/** Lower is better for every metric here. */
function Delta({ diff, unit, digits = 1 }: { diff: number; unit: string; digits?: number }) {
  const threshold = digits === 0 ? 0.5 : 0.05;
  if (Math.abs(diff) < threshold) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted">
        <Icon name="minus" size={12} /> same as today
      </span>
    );
  }
  const better = diff < 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${better ? "text-good" : "text-bad"}`}>
      <Icon name={better ? "trend-down" : "trend-up"} size={12} />
      {better ? "−" : "+"}
      {Math.abs(diff).toFixed(digits)}
      {unit} vs today
      <span className="sr-only">{better ? "(better)" : "(worse)"}</span>
    </span>
  );
}

function Tile({ icon, label, value, sub }: { icon: IconName; label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        <Icon name={icon} size={14} /> {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
      {sub && <div className="mt-0.5">{sub}</div>}
    </div>
  );
}

export function MetricsPanel({ persona, day, baselineDay, compare }: Props) {
  const t = day.totals;
  const b = baselineDay.totals;
  const dl = day.deadline;

  return (
    <section aria-labelledby="metrics-heading" className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <h2 id="metrics-heading" className="text-base font-semibold">
        {persona.name}&rsquo;s daily burden
      </h2>
      <p className="mt-1 text-sm text-ink-muted">{persona.summary}</p>

      {dl && (
        <div
          className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ${
            dl.met ? "bg-good-soft text-good" : "bg-bad-soft text-bad"
          }`}
        >
          <Icon name={dl.met ? "check" : "x"} size={18} strokeWidth={3} className="mt-0.5 shrink-0" />
          <span>
            {dl.label}: {dl.met ? "made it" : "missed"} — {dl.actualMin.toFixed(1)} of {dl.withinMin} min
            {dl.met
              ? ` (${(dl.withinMin - dl.actualMin).toFixed(1)} min to spare)`
              : ` (${(dl.actualMin - dl.withinMin).toFixed(1)} min too slow)`}
          </span>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Tile
          icon="clock"
          label="Travel + waiting"
          value={<CountUp value={t.minutes} format={(n) => `${n.toFixed(1)} min`} />}
          sub={compare && <Delta diff={t.minutes - b.minutes} unit=" min" />}
        />
        <Tile
          icon="walk"
          label={persona.icon === "wheelchair" ? "Distance wheeled" : "Distance walked"}
          value={<CountUp value={t.distanceM} format={fmtDistance} />}
          sub={compare && <Delta diff={t.distanceM - b.distanceM} unit=" m" digits={0} />}
        />
        <Tile
          icon="pause"
          label="Waiting"
          value={<CountUp value={t.waitMin} format={(n) => `${n.toFixed(1)} min`} />}
          sub={compare && <Delta diff={t.waitMin - b.waitMin} unit=" min" />}
        />
        <Tile
          icon="warning"
          label="Barriers"
          value={<CountUp value={t.barrierCount} format={(n) => `${Math.round(n)}`} />}
          sub={
            compare ? (
              <Delta diff={t.barrierCount - b.barrierCount} unit="" digits={0} />
            ) : (
              <span className="text-xs text-ink-muted">{t.restMin.toFixed(1)} min lost to rest stops</span>
            )
          }
        />
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Time spent at stops ({Math.round(t.dwellMin)} min) is not counted as journey time.
      </p>
    </section>
  );
}

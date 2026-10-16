"use client";

import { motion } from "framer-motion";
import { CountUp } from "@/components/metrics/CountUp";
import { Icon } from "@/components/system/Icon";
import type { DesignChange, Persona, PersonaDelta, TradeOff } from "@/lib/simulation/types";
import { listJoin } from "@/lib/ui/format";
import { PERSONA_ICON, VERDICT_STYLE, personaColor } from "@/lib/ui/styles";

interface Props {
  personas: Persona[];
  deltas: PersonaDelta[];
  tradeOffs: TradeOff[];
  activeDesigns: DesignChange[];
  allDesigns: DesignChange[];
  selectedId: string;
}

export function TimeReturned({ personas, deltas, tradeOffs, activeDesigns, allDesigns, selectedId }: Props) {
  const nameOf = (id: string) => personas.find((p) => p.id === id)?.name ?? id;
  const titleOf = (id: string) => allDesigns.find((d) => d.id === id)?.title ?? id;

  if (activeDesigns.length === 0) {
    return (
      <section aria-labelledby="returned-heading" className="rounded-2xl border border-dashed border-stone-400 bg-card p-5 text-center">
        <h2 id="returned-heading" className="text-base font-semibold">
          Time returned by design
        </h2>
        <Icon name="sparkle" size={28} className="mx-auto mt-3 text-brand" />
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
          Switch on a design change above to see who gets time back, who loses out, and by how much.
        </p>
      </section>
    );
  }

  const totalHours = deltas.reduce((s, d) => s + d.savedHoursPerYear, 0);
  const maxAbs = Math.max(1, ...deltas.map((d) => Math.abs(d.savedMin)));
  const combined = tradeOffs.find((t) => t.designIds.length > 1);
  const anyWorse = deltas.some((d) => d.verdict === "worse");

  return (
    <section aria-labelledby="returned-heading" className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <h2 id="returned-heading" className="text-base font-semibold">
        Time returned by design
      </h2>
      <p className="mt-1 text-sm text-ink-muted">With: {listJoin(activeDesigns.map((d) => d.shortTitle.toLowerCase()))}</p>

      <p className="mt-3 rounded-xl bg-brand-soft px-3 py-2.5 text-brand-strong">
        <span className="text-2xl font-bold">
          <CountUp value={totalHours} format={(n) => `${n >= 0 ? "" : "−"}${Math.abs(n).toFixed(0)} hours`} />
        </span>{" "}
        <span className="text-sm font-medium">a year returned to these four residents</span>
      </p>

      <table className="mt-3 w-full border-separate border-spacing-y-1.5 text-sm">
        <caption className="sr-only">Minutes per day saved or lost by each resident with the selected changes</caption>
        <thead>
          <tr className="text-left text-xs text-ink-muted">
            <th scope="col" className="font-semibold">
              Resident
            </th>
            <th scope="col" className="font-semibold">
              Before → after
            </th>
            <th scope="col" className="w-[38%] font-semibold">
              <span className="sr-only">Change per day</span>
              <span aria-hidden="true" className="flex justify-between">
                <span>lost</span>
                <span>returned</span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {deltas.map((d) => {
            const p = personas.find((x) => x.id === d.personaId);
            if (!p) return null;
            const v = VERDICT_STYLE[d.verdict];
            const pct = (Math.abs(d.savedMin) / maxAbs) * 50;
            const selected = p.id === selectedId;
            return (
              <tr key={p.id} className={selected ? "bg-stone-100" : undefined}>
                <th scope="row" className="rounded-l-lg py-1.5 pl-1.5 text-left font-medium">
                  <span className="flex items-center gap-1.5">
                    <Icon name={PERSONA_ICON[p.icon]} size={16} style={{ color: personaColor(p.id) }} />
                    {p.name}
                  </span>
                </th>
                <td className="tabular-nums text-ink-muted">
                  {d.beforeMin.toFixed(1)} → <span className="font-semibold text-ink">{d.afterMin.toFixed(1)}</span> min
                </td>
                <td className="rounded-r-lg pr-1.5">
                  <div className="relative h-6 rounded bg-stone-100" aria-hidden="true">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-stone-400" />
                    <motion.div
                      className={`absolute inset-y-1 rounded ${d.savedMin >= 0 ? "bg-good" : "bg-bad"}`}
                      style={d.savedMin >= 0 ? { left: "50%" } : { right: "50%" }}
                      initial={false}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                  <span className={`mt-0.5 flex items-center gap-1 text-xs font-semibold ${v.text}`}>
                    <Icon name={v.icon} size={10} />
                    {d.verdict === "neutral"
                      ? "No change"
                      : `${d.savedMin > 0 ? "+" : "−"}${Math.abs(d.savedMin).toFixed(1)} min/day · ${Math.abs(d.savedHoursPerYear).toFixed(0)} h/yr ${d.savedMin > 0 ? "returned" : "lost"}`}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h3 className="mt-4 text-sm font-semibold">Trade-offs</h3>
      <ul className="mt-1.5 space-y-2">
        {tradeOffs
          .filter((t) => t.designIds.length === 1)
          .map((t) => (
            <li key={t.designIds.join()} className="flex gap-2 rounded-xl border border-warn/30 bg-warn-soft p-3 text-sm">
              <Icon name="warning" size={18} className="mt-0.5 shrink-0 text-warn" />
              <span>
                <span className="font-semibold">{titleOf(t.designIds[0]!)}</span> helps {listJoin(t.winners.map(nameOf))}, but{" "}
                {t.losers.map((l, i) => (
                  <span key={l.personaId}>
                    {i > 0 && " and "}
                    <span className="font-semibold text-bad">
                      {nameOf(l.personaId)} loses {l.lostMin.toFixed(1)} min a day
                    </span>
                    <span className="block text-xs text-ink-muted">Why: {l.reason}</span>
                  </span>
                ))}
              </span>
            </li>
          ))}
        {combined ? (
          <li className="flex gap-2 rounded-xl border border-bad/30 bg-bad-soft p-3 text-sm">
            <Icon name="warning" size={18} className="mt-0.5 shrink-0 text-bad" />
            <span>
              <span className="font-semibold">Together</span>, these changes still leave{" "}
              {listJoin(combined.losers.map((l) => `${nameOf(l.personaId)} (−${l.lostMin.toFixed(1)} min)`))} worse off.
            </span>
          </li>
        ) : (
          !anyWorse && (
            <li className="flex gap-2 rounded-xl border border-good/30 bg-good-soft p-3 text-sm font-medium text-good">
              <Icon name="check" size={18} strokeWidth={3} className="mt-0.5 shrink-0" />
              {activeDesigns.length > 1
                ? "Together, these changes leave nobody worse off."
                : "No trade-off: nobody is worse off."}
            </li>
          )
        )}
      </ul>
    </section>
  );
}

"use client";

import { Icon } from "@/components/system/Icon";
import type { DesignChange, DesignImpact, Persona } from "@/lib/simulation/types";
import { fmtRM } from "@/lib/ui/format";
import { DESIGN_ICON, PERSONA_ICON, VERDICT_STYLE, personaColor } from "@/lib/ui/styles";

interface Props {
  designs: DesignChange[];
  impacts: DesignImpact[];
  personas: Persona[];
  active: string[];
  onToggle: (id: string) => void;
}

export function DesignToggles({ designs, impacts, personas, active, onToggle }: Props) {
  return (
    <section aria-labelledby="designs-heading" id="redesign" className="scroll-mt-4">
      <h2 id="designs-heading" className="flex items-center gap-2 text-lg font-bold">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand text-sm text-white">2</span>
        Try a design change
      </h2>
      <p className="mt-1 text-sm text-ink-muted">Switch changes on and off. Every resident&rsquo;s day is recalculated instantly.</p>

      <ul className="mt-3 space-y-2.5">
        {designs.map((d) => {
          const on = active.includes(d.id);
          const impact = impacts.find((i) => i.designId === d.id);
          return (
            <li
              key={d.id}
              className={`rounded-2xl border-2 bg-card p-3.5 shadow-sm transition-colors ${on ? "border-brand" : "border-line"}`}
            >
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-labelledby={`design-${d.id}-title`}
                aria-describedby={`design-${d.id}-summary`}
                onClick={() => onToggle(d.id)}
                className="flex w-full items-center gap-3 rounded-lg text-left"
              >
                <span
                  className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${on ? "bg-brand text-white" : "bg-brand-soft text-brand"}`}
                >
                  <Icon name={DESIGN_ICON[d.icon]} size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span id={`design-${d.id}-title`} className="block font-semibold text-ink">
                    {d.title}
                  </span>
                  <span className="block text-xs text-ink-muted">{fmtRM(d.costRM)} · illustrative cost</span>
                </span>
                <span
                  aria-hidden="true"
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors ${
                    on ? "border-brand bg-brand" : "border-stone-500 bg-stone-200"
                  }`}
                >
                  <span
                    className={`absolute inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transition-transform ${
                      on ? "translate-x-[22px] text-brand" : "translate-x-[2px] text-stone-500"
                    }`}
                  >
                    <Icon name={on ? "check" : "x"} size={12} strokeWidth={3} />
                  </span>
                </span>
                <span className="w-7 text-xs font-bold text-ink" aria-hidden="true">
                  {on ? "ON" : "OFF"}
                </span>
              </button>
              <p id={`design-${d.id}-summary`} className="mt-2 text-sm text-ink">
                {d.summary}
              </p>
              {impact && (
                <div className="mt-2">
                  <p className="text-xs font-semibold text-ink-muted">On its own, per day:</p>
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {impact.deltas.map((delta) => {
                      const p = personas.find((x) => x.id === delta.personaId);
                      if (!p) return null;
                      const v = VERDICT_STYLE[delta.verdict];
                      const text =
                        delta.verdict === "neutral" ? "no change" : `${delta.savedMin > 0 ? "+" : "−"}${Math.abs(delta.savedMin).toFixed(1)} min`;
                      return (
                        <li key={p.id} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${v.bg} ${v.text}`}>
                          <Icon name={PERSONA_ICON[p.icon]} size={13} style={{ color: personaColor(p.id) }} />
                          <span className="text-ink">{p.name}</span>
                          <Icon name={v.icon} size={10} />
                          <span>{text}</span>
                          <span className="sr-only">({v.label})</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

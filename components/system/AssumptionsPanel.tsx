"use client";

import { useEffect, useRef } from "react";
import assumptions from "@/lib/data/assumptions.json";
import { MODEL } from "@/lib/simulation/cost";
import type { DesignChange, Persona, Township } from "@/lib/simulation/types";
import { fmtRM } from "@/lib/ui/format";
import { Icon } from "./Icon";

type SourceKey = keyof typeof assumptions.sources;
const source = (key: string) => assumptions.sources[key as SourceKey] ?? assumptions.sources.illustrative;

interface Props {
  open: boolean;
  onClose: () => void;
  township: Township;
  personas: Persona[];
  designs: DesignChange[];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="text-sm font-bold uppercase tracking-wide text-ink-muted">{title}</h3>
      <div className="mt-2 overflow-x-auto">{children}</div>
    </section>
  );
}

const th = "border-b border-line px-2 py-1.5 text-left text-xs font-semibold text-ink-muted";
const td = "border-b border-line px-2 py-1.5 align-top";

/**
 * Every parameter the simulation uses, with a source label. Built from the same data the
 * engine runs on, so it cannot drift out of date.
 */
export function AssumptionsPanel({ open, onClose, township, personas, designs }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const crossings = township.edges.filter((e) => e.crossing);
  const designCrossings = designs.flatMap((d) =>
    d.patches.flatMap((p) => (p.op === "addEdge" && p.edge.crossing ? [{ design: d.title, edge: p.edge }] : [])),
  );

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="assumptions-title"
      className="m-auto max-h-[90vh] w-[min(56rem,calc(100vw-2rem))] rounded-2xl bg-card p-0 text-ink shadow-2xl backdrop:bg-black/50"
    >
      <div className="sticky top-0 flex items-center justify-between gap-4 border-b border-line bg-card px-5 py-4">
        <h2 id="assumptions-title" className="text-lg font-bold">
          Assumptions
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:bg-stone-50"
        >
          <Icon name="x" size={16} /> Close
        </button>
      </div>
      <div className="px-5 pb-6">
        <p className="mt-4 rounded-xl bg-warn-soft p-3 text-sm font-medium text-warn">{assumptions.disclaimer}</p>

        <Section title="Residents (fictional personas)">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr>
                {["Persona", "Speed", "Comfortable walk without a seat", "Step-free only", "Heat-sensitive", "Rest stop costs", "Days / year", "Source"].map((h) => (
                  <th key={h} scope="col" className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {personas.map((p) => (
                <tr key={p.id}>
                  <th scope="row" className={`${td} text-left font-semibold`}>
                    {p.name}
                  </th>
                  <td className={td}>{p.speedMps} m/s</td>
                  <td className={td}>{p.maxContinuousWalkM} m</td>
                  <td className={td}>{p.requiresStepFree ? "Yes" : "No"}</td>
                  <td className={td}>{p.heatSensitive ? "Yes" : "No"}</td>
                  <td className={td}>{p.restPenaltyMin} min</td>
                  <td className={td}>{p.daysPerYear}</td>
                  <td className={`${td} text-ink-muted`}>{source("persona")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Crossings and waits">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr>
                {["Where", "Peak", "Off-peak", "Night", "Source"].map((h) => (
                  <th key={h} scope="col" className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...crossings.map((e) => ({ label: e.crossing!.label, w: e.crossing!.waitS, note: "" })), ...designCrossings.map((c) => ({ label: c.edge.crossing!.label, w: c.edge.crossing!.waitS, note: ` (${c.design})` }))].map((r) => (
                <tr key={r.label}>
                  <th scope="row" className={`${td} text-left font-medium`}>
                    {r.label}
                    {r.note}
                  </th>
                  <td className={td}>{r.w.peak} s</td>
                  <td className={td}>{r.w.offpeak} s</td>
                  <td className={td}>{r.w.night} s</td>
                  <td className={`${td} text-ink-muted`}>{source("illustrative")}</td>
                </tr>
              ))}
              {township.nodes
                .filter((n) => n.waitMin)
                .map((n) => (
                  <tr key={n.id}>
                    <th scope="row" className={`${td} text-left font-medium`}>
                      Queue at {n.label}
                    </th>
                    <td className={td}>{n.waitMin?.peak ?? 0} min</td>
                    <td className={td}>{n.waitMin?.offpeak ?? 0} min</td>
                    <td className={td}>{n.waitMin?.night ?? 0} min</td>
                    <td className={`${td} text-ink-muted`}>{source("illustrative")}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Section>

        <Section title="Design changes">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr>
                {["Change", "Estimated cost", "What it includes", "Source"].map((h) => (
                  <th key={h} scope="col" className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {designs.map((d) => (
                <tr key={d.id}>
                  <th scope="row" className={`${td} text-left font-medium`}>
                    {d.title}
                  </th>
                  <td className={td}>{fmtRM(d.costRM)}</td>
                  <td className={td}>{d.costNote}</td>
                  <td className={`${td} text-ink-muted`}>{source("cost")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Model parameters">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr>
                {["Parameter", "Value", "Source"].map((h) => (
                  <th key={h} scope="col" className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assumptions.model.map((m) => (
                <tr key={m.key}>
                  <th scope="row" className={`${td} text-left font-medium`}>
                    {m.label}
                  </th>
                  <td className={td}>
                    {(MODEL[m.key as keyof typeof MODEL] * m.scale).toLocaleString()} {m.unit}
                  </td>
                  <td className={`${td} text-ink-muted`}>{source(m.source)}</td>
                </tr>
              ))}
              <tr>
                <th scope="row" className={`${td} text-left font-medium`}>
                  Network size
                </th>
                <td className={td}>
                  {township.nodes.length} places, {township.edges.length} path segments,{" "}
                  {(township.edges.reduce((s, e) => s + e.lengthM, 0) / 1000).toFixed(1)} km of paths
                </td>
                <td className={`${td} text-ink-muted`}>{source("illustrative")}</td>
              </tr>
            </tbody>
          </table>
        </Section>

        <Section title="Rules">
          <dl className="space-y-2 text-sm">
            {assumptions.rules.map((r) => (
              <div key={r.label} className="grid gap-1 sm:grid-cols-[12rem_1fr]">
                <dt className="font-semibold">{r.label}</dt>
                <dd>
                  {r.value} <span className="text-ink-muted">· {source(r.source)}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>
    </dialog>
  );
}

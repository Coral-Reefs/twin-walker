"use client";

import { MotionConfig } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DesignToggles } from "@/components/design/DesignToggles";
import { TimeReturned } from "@/components/design/TimeReturned";
import { DecisionDashboard } from "@/components/jury/DecisionDashboard";
import { RankingForm } from "@/components/jury/RankingForm";
import { KeyFindings } from "@/components/map/KeyFindings";
import { TownshipMap } from "@/components/map/TownshipMap";
import { MetricsPanel } from "@/components/metrics/MetricsPanel";
import { PersonaPicker } from "@/components/persona/PersonaPicker";
import { AssumptionsPanel } from "@/components/system/AssumptionsPanel";
import { DbProvider, useDb } from "@/components/system/DbProvider";
import { DbStatusBadge } from "@/components/system/DbStatusBadge";
import { ErrorBoundary } from "@/components/system/ErrorBoundary";
import { Icon } from "@/components/system/Icon";
import { designs, personas, township } from "@/lib/data";
import { applyDesigns, evaluateDesign, evaluateScenario, simulateAll } from "@/lib/simulation";
import { listJoin } from "@/lib/ui/format";

export function DayZeroApp() {
  return (
    <MotionConfig reducedMotion="user">
      <DbProvider>
        <App />
      </DbProvider>
    </MotionConfig>
  );
}

function App() {
  const db = useDb();
  const [personaId, setPersonaId] = useState(personas[0]!.id);
  const [active, setActive] = useState<string[]>([]);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const lastAction = useRef<string | null>(null);

  // The simulation is pure and fast: recompute everything from local JSON on every change.
  const baseline = useMemo(() => simulateAll(township, personas), []);
  const impacts = useMemo(() => designs.map((d) => evaluateDesign(township, personas, designs, d.id, baseline)), [baseline]);
  const scenarioTownship = useMemo(() => applyDesigns(township, designs, active), [active]);
  const scenario = useMemo(() => evaluateScenario(township, personas, designs, active), [active]);

  const persona = personas.find((p) => p.id === personaId) ?? personas[0]!;
  const day = scenario.scenario[persona.id]!;
  const baselineDay = scenario.baseline[persona.id]!;
  const activeDesigns = designs.filter((d) => active.includes(d.id));

  const announce = useCallback((msg: string) => {
    // Clear first so repeating the same sentence is still announced.
    setAnnouncement("");
    window.setTimeout(() => setAnnouncement(msg), 60);
  }, []);

  // Announce metric changes after a user action (not on first load).
  useEffect(() => {
    if (lastAction.current === null) return;
    const delta = scenario.deltas.find((d) => d.personaId === persona.id);
    const parts = [lastAction.current, `${persona.name}: ${day.totals.minutes.toFixed(1)} minutes travelling and waiting`];
    if (delta && active.length > 0 && Math.abs(delta.savedMin) >= 0.05) {
      parts[1] += delta.savedMin > 0 ? `, ${delta.savedMin.toFixed(1)} less than today` : `, ${(-delta.savedMin).toFixed(1)} more than today`;
    }
    parts.push(`${day.totals.barrierCount} ${day.totals.barrierCount === 1 ? "barrier" : "barriers"}.`);
    if (day.deadline) parts.push(day.deadline.met ? `Makes ${day.deadline.label}.` : `Misses ${day.deadline.label}.`);
    const losers = scenario.deltas.filter((d) => d.verdict === "worse").map((d) => personas.find((p) => p.id === d.personaId)?.name ?? d.personaId);
    if (losers.length) parts.push(`Trade-off: ${listJoin(losers)} worse off.`);
    announce(parts.join(" "));
    lastAction.current = null;
  }, [scenario, persona, day, active.length, announce]);

  const selectPersona = (id: string) => {
    setPersonaId(id);
    lastAction.current = "";
    db.track("persona_selected", { personaId: id });
  };

  const toggleDesign = (id: string) => {
    const on = !active.includes(id);
    const next = on ? [...active, id] : active.filter((x) => x !== id);
    setActive(next);
    lastAction.current = `${designs.find((d) => d.id === id)?.title} ${on ? "on" : "off"}.`;
    db.track("design_toggled", { designId: id, on, active: next });
  };

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-lg font-black text-white" aria-hidden="true">
              D0
            </span>
            <div>
              <p className="text-xl font-black tracking-tight">DayZero</p>
              <p className="text-xs text-ink-muted">Test your future township before it exists</p>
            </div>
          </div>
          <nav aria-label="Steps" className="order-3 w-full sm:order-none sm:w-auto">
            <ol className="flex gap-1 text-sm font-semibold">
              {[
                ["#simulate", "1 · Live a day"],
                ["#redesign", "2 · Redesign"],
                ["#jury", "3 · Jury"],
              ].map(([href, label]) => (
                <li key={href}>
                  <a href={href} className="rounded-lg px-2.5 py-1.5 text-ink hover:bg-stone-100">
                    {label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <DbStatusBadge />
            <button
              type="button"
              onClick={() => setAssumptionsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold hover:bg-stone-50"
              aria-haspopup="dialog"
            >
              <Icon name="info" size={14} /> Assumptions
            </button>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-7xl px-4 pb-16 pt-5">
        <p className="max-w-3xl text-sm text-ink">
          Architects simulate buildings, traffic and sunlight, but not the everyday effort a neighbourhood asks of the people
          who live in it. Follow four future residents through an{" "}
          <span className="font-semibold">illustrative township</span>, then try small design changes and see who gets time back.
        </p>

        <div id="simulate" className="mt-5 grid scroll-mt-4 gap-5 lg:grid-cols-12 lg:items-start">
          <div className="min-w-0 lg:col-span-5 lg:col-start-8 lg:row-start-1">
            <h2 className="mb-2 flex items-center gap-2 text-lg font-bold">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand text-sm text-white">1</span>
              Live a day in the township
            </h2>
            <PersonaPicker personas={personas} selectedId={persona.id} onSelect={selectPersona} />
          </div>

          <div className="min-w-0 lg:sticky lg:top-4 lg:col-span-7 lg:col-start-1 lg:row-span-6 lg:row-start-1 lg:self-start">
            <ErrorBoundary name="township map">
              <TownshipMap
                base={township}
                township={scenarioTownship}
                persona={persona}
                day={day}
                baselineDay={baselineDay}
                activeDesigns={activeDesigns}
              />
            </ErrorBoundary>
          </div>

          <div className="min-w-0 lg:col-span-5 lg:col-start-8">
            <MetricsPanel persona={persona} day={day} baselineDay={baselineDay} compare={active.length > 0} />
          </div>

          <div className="min-w-0 lg:col-span-5 lg:col-start-8">
            <DesignToggles designs={designs} impacts={impacts} personas={personas} active={active} onToggle={toggleDesign} />
          </div>

          <div className="min-w-0 lg:col-span-5 lg:col-start-8">
            <TimeReturned
              personas={personas}
              deltas={scenario.deltas}
              tradeOffs={scenario.tradeOffs}
              activeDesigns={activeDesigns}
              allDesigns={designs}
              selectedId={persona.id}
            />
          </div>

          <div className="min-w-0 lg:col-span-5 lg:col-start-8">
            <KeyFindings persona={persona} day={day} />
          </div>
        </div>

        <section id="jury" aria-labelledby="jury-heading" className="mt-10 scroll-mt-4">
          <h2 id="jury-heading" className="flex items-center gap-2 text-lg font-bold">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand text-sm text-white">3</span>
            Resident design jury
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-ink-muted">
            If the township can fund one change first, which should it be? Rank the three, then compare what residents want with
            what the simulation says.
          </p>
          <div className="mt-4 grid gap-5 lg:grid-cols-12 lg:items-start">
            <div className="min-w-0 lg:col-span-5">
              <RankingForm designs={designs} announce={announce} />
            </div>
            <div className="min-w-0 lg:col-span-7">
              <ErrorBoundary name="decision dashboard">
                <DecisionDashboard designs={designs} impacts={impacts} personas={personas} />
              </ErrorBoundary>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-card">
        <div className="mx-auto max-w-7xl px-4 py-5 text-xs text-ink-muted">
          <p>{township.meta.disclaimer}</p>
          <p className="mt-1">
            Personas, distances, waits and costs are illustrative assumptions.{" "}
            <button type="button" onClick={() => setAssumptionsOpen(true)} className="font-semibold text-ink underline underline-offset-2">
              See every assumption
            </button>
            .
          </p>
        </div>
      </footer>

      <AssumptionsPanel open={assumptionsOpen} onClose={() => setAssumptionsOpen(false)} township={township} personas={personas} designs={designs} />

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </>
  );
}

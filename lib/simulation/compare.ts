import { MODEL, waitBand } from "./cost";
import { applyDesigns } from "./designs";
import { simulateDay } from "./journey";
import type {
  Barrier,
  DayResult,
  DesignChange,
  DesignImpact,
  LegResult,
  PathEdge,
  Persona,
  PersonaDelta,
  ScenarioResult,
  Township,
  TradeOff,
  Verdict,
} from "./types";

const barrierKey = (b: Barrier) => `${b.type}|${b.legIndex}`;

/** Barriers matched by (type, leg): what disappeared and what appeared. */
export function diffBarriers(before: Barrier[], after: Barrier[]): { removed: Barrier[]; added: Barrier[] } {
  const take = (from: Barrier[], against: Barrier[]) => {
    const pool = new Map<string, number>();
    for (const b of against) pool.set(barrierKey(b), (pool.get(barrierKey(b)) ?? 0) + 1);
    return from.filter((b) => {
      const k = barrierKey(b);
      const n = pool.get(k) ?? 0;
      if (n > 0) {
        pool.set(k, n - 1);
        return false;
      }
      return true;
    });
  };
  return { removed: take(before, after), added: take(after, before) };
}

function verdictFor(savedMin: number, netBarriersRemoved: number): Verdict {
  if (savedMin >= MODEL.verdictThresholdMin) return "benefits";
  if (savedMin <= -MODEL.verdictThresholdMin) return "worse";
  if (netBarriersRemoved > 0) return "benefits";
  if (netBarriersRemoved < 0) return "worse";
  return "neutral";
}

export interface EdgeSets {
  before: PathEdge[];
  after: PathEdge[];
}

/** Edges whose crossing wait is new or longer after the change (in the given period). */
function newlyDelayed(edges: EdgeSets, period: LegResult["period"]): Map<string, PathEdge> {
  const band = waitBand(period);
  const prev = new Map(edges.before.map((e) => [e.id, e]));
  const out = new Map<string, PathEdge>();
  for (const e of edges.after) {
    const wasWait = prev.get(e.id)?.crossing?.waitS[band] ?? 0;
    if (e.crossing && e.crossing.waitS[band] > wasWait) out.set(e.id, e);
  }
  return out;
}

/** Plain-language reason for the leg that got worst, e.g. "Clinic → Wet Market: Junction crossing removed — route 275 m longer". */
export function explainWorsening(before: DayResult, after: DayResult, edges: EdgeSets): string {
  const afterIds = new Set(edges.after.map((e) => e.id));
  let worst = -Infinity;
  let reason = "";
  after.legs.forEach((leg, i) => {
    const prev = before.legs[i];
    if (!prev) return;
    const diff = leg.totalMin - prev.totalMin;
    if (diff <= worst) return;
    worst = diff;

    let cause = "";
    const removed = edges.before.find((e) => prev.edgeIds.includes(e.id) && !afterIds.has(e.id));
    const delayed = newlyDelayed(edges, leg.period);
    const waitedAt = leg.edgeIds.map((id) => delayed.get(id)).find(Boolean);
    const avoided = prev.edgeIds.map((id) => delayed.get(id)).find(Boolean);
    if (removed) cause = `${removed.label} removed`;
    else if (waitedAt) cause = `waits at ${waitedAt.crossing!.label}`;
    else if (avoided) cause = `detours around ${avoided.crossing!.label}`;

    const parts: string[] = [];
    const dm = leg.distanceM - prev.distanceM;
    if (dm >= 20) parts.push(`route ${Math.round(dm)} m longer`);
    const dw = leg.crossingWaitMin + leg.queueWaitMin - (prev.crossingWaitMin + prev.queueWaitMin);
    if (dw >= 0.25) parts.push(`+${dw.toFixed(1)} min waiting`);
    const dr = leg.restMin - prev.restMin;
    if (dr >= 0.25) parts.push(`+${dr.toFixed(1)} min rest stops`);
    const detail = parts.join(", ") || "slower journey";
    reason = `${leg.fromLabel} → ${leg.toLabel}: ${cause ? `${cause} — ${detail}` : detail}`;
  });
  return reason;
}

export function comparePersona(
  persona: Persona,
  before: DayResult,
  after: DayResult,
  edges: EdgeSets = { before: [], after: [] },
): PersonaDelta {
  const savedMin = before.totals.minutes - after.totals.minutes;
  const { removed, added } = diffBarriers(before.barriers, after.barriers);
  const verdict = verdictFor(savedMin, removed.length - added.length);
  return {
    personaId: persona.id,
    beforeMin: before.totals.minutes,
    afterMin: after.totals.minutes,
    savedMin,
    savedHoursPerYear: (savedMin * persona.daysPerYear) / 60,
    barriersBefore: before.totals.barrierCount,
    barriersAfter: after.totals.barrierCount,
    barrierMinBefore: before.totals.barrierMin,
    barrierMinAfter: after.totals.barrierMin,
    barriersRemoved: removed,
    barriersAdded: added,
    verdict,
    deadlineBefore: before.deadline,
    deadlineAfter: after.deadline,
    reason: verdict === "worse" ? explainWorsening(before, after, edges) : undefined,
  };
}

export function simulateAll(township: Township, personas: Persona[]): Record<string, DayResult> {
  return Object.fromEntries(personas.map((p) => [p.id, simulateDay(township, p)]));
}

function impactFrom(designId: string, deltas: PersonaDelta[]): DesignImpact {
  return {
    designId,
    deltas,
    totalSavedMinPerDay: deltas.reduce((s, d) => s + d.savedMin, 0),
    totalHoursPerYear: deltas.reduce((s, d) => s + d.savedHoursPerYear, 0),
    barriersRemoved: deltas.reduce((s, d) => s + d.barriersRemoved.length, 0),
    barriersAdded: deltas.reduce((s, d) => s + d.barriersAdded.length, 0),
    barrierMinRemoved: deltas.reduce((s, d) => s + d.barrierMinBefore - d.barrierMinAfter, 0),
    winners: deltas.filter((d) => d.verdict === "benefits").map((d) => d.personaId),
    losers: deltas.filter((d) => d.verdict === "worse").map((d) => d.personaId),
  };
}

/** Impact of one design change on its own, compared with the baseline township. */
export function evaluateDesign(
  base: Township,
  personas: Persona[],
  designs: DesignChange[],
  designId: string,
  baseline: Record<string, DayResult> = simulateAll(base, personas),
): DesignImpact {
  const township = applyDesigns(base, designs, [designId]);
  const deltas = personas.map((p) =>
    comparePersona(p, baseline[p.id]!, simulateDay(township, p), { before: base.edges, after: township.edges }),
  );
  return impactFrom(designId, deltas);
}

function tradeOffFrom(designIds: string[], deltas: PersonaDelta[]): TradeOff | null {
  const winners = deltas.filter((d) => d.verdict === "benefits").map((d) => d.personaId);
  const losers = deltas
    .filter((d) => d.verdict === "worse")
    .map((d) => ({ personaId: d.personaId, lostMin: -d.savedMin, reason: d.reason ?? "" }));
  return winners.length > 0 && losers.length > 0 ? { designIds, winners, losers } : null;
}

/**
 * Baseline vs the township with all active designs, plus trade-off flags for
 * each active design on its own and for the combination.
 */
export function evaluateScenario(
  base: Township,
  personas: Persona[],
  designs: DesignChange[],
  activeIds: readonly string[],
): ScenarioResult {
  const baseline = simulateAll(base, personas);
  const township = applyDesigns(base, designs, activeIds);
  const scenario = simulateAll(township, personas);
  const edges = { before: base.edges, after: township.edges };
  const deltas = personas.map((p) => comparePersona(p, baseline[p.id]!, scenario[p.id]!, edges));

  const sortedIds = designs.map((d) => d.id).filter((id) => activeIds.includes(id));
  const tradeOffs: TradeOff[] = [];
  for (const id of sortedIds) {
    const t = tradeOffFrom([id], evaluateDesign(base, personas, designs, id, baseline).deltas);
    if (t) tradeOffs.push(t);
  }
  if (sortedIds.length > 1) {
    const combined = tradeOffFrom(sortedIds, deltas);
    if (combined) tradeOffs.push(combined);
  }

  return { activeDesignIds: sortedIds, baseline, scenario, deltas, tradeOffs };
}

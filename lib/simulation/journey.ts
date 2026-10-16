import { detectCrossingDetour, detectSeatingBarriers } from "./barriers";
import { MODEL, edgeCrossingWaitMin, edgeRoutingCost, edgeWalkMin, waitBand } from "./cost";
import { buildAdjacency, nodeIndex, shortestPath, type Adjacency } from "./graph";
import type { Barrier, DayResult, LegResult, LegStep, Period, Persona, PlaceNode, Township } from "./types";

/** Follow stop relocations introduced by design changes (e.g. a moved pickup point). */
export function resolveStopNode(township: Township, nodeId: string): string {
  let id = nodeId;
  const seen = new Set<string>();
  while (township.relocations[id] && !seen.has(id)) {
    seen.add(id);
    id = township.relocations[id] as string;
  }
  return id;
}

interface LegContext {
  township: Township;
  adj: Adjacency;
  nodes: Map<string, PlaceNode>;
}

export function simulateLeg(
  ctx: LegContext,
  persona: Persona,
  legIndex: number,
  fromId: string,
  toId: string,
  period: Period,
): LegResult {
  const from = ctx.nodes.get(fromId);
  const to = ctx.nodes.get(toId);
  if (!from || !to) throw new Error(`Unknown stop node ${!from ? fromId : toId}`);

  const constrained = shortestPath(ctx.adj, fromId, toId, (e) => edgeRoutingCost(e, persona, period));
  const unconstrained = persona.requiresStepFree
    ? shortestPath(ctx.adj, fromId, toId, (e) => edgeRoutingCost(e, persona, period, { ignoreStepFree: true }))
    : constrained;
  const route = constrained ?? unconstrained;
  if (!route) throw new Error(`No route from ${fromId} to ${toId}`);

  const distanceM = route.edges.reduce((sum, e) => sum + e.lengthM, 0);
  const walkMin = route.edges.reduce((sum, e) => sum + edgeWalkMin(e, persona, period), 0);
  const crossingWaitMin = route.edges.reduce((sum, e) => sum + edgeCrossingWaitMin(e, period), 0);
  const queueWaitMin = to.waitMin?.[waitBand(period)] ?? 0;

  const barriers: Barrier[] = detectSeatingBarriers(legIndex, route.nodeIds, route.edges, persona, ctx.nodes);
  const restMin = barriers.reduce((sum, b) => sum + b.extraMin, 0);

  if (persona.requiresStepFree && unconstrained) {
    const stepped = unconstrained.edges.filter((e) => !e.stepFree);
    const gapMin = constrained ? constrained.cost - unconstrained.cost : Infinity;
    if (stepped.length > 0 && gapMin > MODEL.stepFreeGapThresholdMin) {
      const first = stepped[0]!;
      const a = ctx.nodes.get(first.from)!;
      const b = ctx.nodes.get(first.to)!;
      const unconstrainedM = unconstrained.edges.reduce((sum, e) => sum + e.lengthM, 0);
      barriers.push({
        type: "step-free-gap",
        legIndex,
        edgeIds: stepped.map((e) => e.id),
        focusEdgeId: first.id,
        at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        extraMin: constrained ? gapMin : 0,
        extraM: constrained ? distanceM - unconstrainedM : 0,
        detail: constrained
          ? `Steps at ${first.label}: step-free route is ${Math.round(distanceM - unconstrainedM)} m longer`
          : `No step-free route — steps at ${first.label}`,
      });
    }
  }

  const detour = detectCrossingDetour(
    legIndex,
    from,
    to,
    route.edges,
    distanceM,
    persona,
    ctx.nodes,
    ctx.township.meta.metresPerUnit,
  );
  if (detour) barriers.push(detour);

  const restByEdge = new Map<string, number>();
  for (const b of barriers) {
    if (b.type === "no-seating") restByEdge.set(b.focusEdgeId, (restByEdge.get(b.focusEdgeId) ?? 0) + b.extraMin);
  }
  const steps: LegStep[] = route.edges.map((e, i) => {
    const a = ctx.nodes.get(route.nodeIds[i]!)!;
    const b = ctx.nodes.get(route.nodeIds[i + 1]!)!;
    const waitMin = edgeCrossingWaitMin(e, period);
    return {
      edgeId: e.id,
      from: { x: a.x, y: a.y },
      to: { x: b.x, y: b.y },
      walkMin: edgeWalkMin(e, persona, period),
      waitMin,
      waitLabel: waitMin > 0 ? e.crossing?.label : undefined,
      restMin: restByEdge.get(e.id) ?? 0,
    };
  });

  return {
    index: legIndex,
    fromNodeId: fromId,
    toNodeId: toId,
    fromLabel: from.label,
    toLabel: to.label,
    period,
    nodeIds: route.nodeIds,
    edgeIds: route.edges.map((e) => e.id),
    points: route.nodeIds.map((id) => {
      const n = ctx.nodes.get(id)!;
      return { x: n.x, y: n.y };
    }),
    steps,
    distanceM,
    walkMin,
    crossingWaitMin,
    queueWaitMin,
    restMin,
    totalMin: walkMin + crossingWaitMin + queueWaitMin + restMin,
    reachable: constrained !== null,
    barriers,
  };
}

/** Simulate a persona's whole routine on a township. Pure and deterministic. */
export function simulateDay(township: Township, persona: Persona): DayResult {
  const ctx: LegContext = { township, adj: buildAdjacency(township), nodes: nodeIndex(township) };
  const stops = persona.routine.map((s) => ({ ...s, nodeId: resolveStopNode(township, s.nodeId) }));

  const legs: LegResult[] = [];
  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i - 1]!;
    const stop = stops[i]!;
    legs.push(simulateLeg(ctx, persona, i - 1, prev.nodeId, stop.nodeId, stop.period));
  }

  const barriers = legs.flatMap((l) => l.barriers);
  const sum = (pick: (l: LegResult) => number) => legs.reduce((s, l) => s + pick(l), 0);
  const totals = {
    minutes: sum((l) => l.totalMin),
    walkMin: sum((l) => l.walkMin),
    waitMin: sum((l) => l.crossingWaitMin + l.queueWaitMin),
    restMin: sum((l) => l.restMin),
    distanceM: sum((l) => l.distanceM),
    barrierCount: barriers.length,
    barrierMin: barriers.reduce((s, b) => s + b.extraMin, 0),
    dwellMin: stops.slice(1, -1).reduce((s, st) => s + st.dwellMin, 0),
  };

  let deadline: DayResult["deadline"];
  if (persona.deadline) {
    const { fromStop, toStop, withinMin, label } = persona.deadline;
    const legMin = legs.slice(fromStop, toStop).reduce((s, l) => s + l.totalMin, 0);
    const dwell = stops.slice(fromStop + 1, toStop).reduce((s, st) => s + st.dwellMin, 0);
    const actualMin = legMin + dwell;
    deadline = { label, withinMin, actualMin, met: actualMin <= withinMin };
  }

  return { personaId: persona.id, legs, totals, barriers, deadline };
}

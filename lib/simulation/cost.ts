import type { PathEdge, Period, Persona, WaitBand } from "./types";

/**
 * Model constants. Every value here is listed in the Assumptions panel
 * (lib/data/assumptions.json) — keep the two in sync.
 */
export const MODEL = {
  /** Unshaded midday walking is this much slower for heat-sensitive personas. */
  heatSlowdown: 0.15,
  /** A route is "direct" if it is at most this multiple of the straight-line distance. */
  directnessFactor: 1.2,
  /** Detour barrier when the route exceeds this multiple of straight-line distance… */
  detourRatioThreshold: 1.4,
  /** …and is at least this many metres longer than a direct route. */
  detourMinExtraM: 100,
  /** Changes smaller than this (minutes) are treated as "no change". */
  verdictThresholdMin: 0.5,
  /** Step-free detours shorter than this (minutes) are not counted as a barrier. */
  stepFreeGapThresholdMin: 0.25,
} as const;

export function waitBand(period: Period): WaitBand {
  if (period === "am-peak" || period === "pm-peak") return "peak";
  if (period === "night") return "night";
  return "offpeak";
}

/** True if seats on this edge are close enough that the persona never walks past their limit. */
export function isSeated(edge: PathEdge, persona: Persona): boolean {
  if (edge.seatsPer100m <= 0) return false;
  const gapM = 100 / edge.seatsPer100m;
  return gapM <= persona.maxContinuousWalkM;
}

export function edgeWalkMin(edge: PathEdge, persona: Persona, period: Period): number {
  const base = edge.lengthM / persona.speedMps / 60;
  const hot = persona.heatSensitive && period === "midday" && !edge.shaded;
  return hot ? base * (1 + MODEL.heatSlowdown) : base;
}

export function edgeCrossingWaitMin(edge: PathEdge, period: Period): number {
  return edge.crossing ? edge.crossing.waitS[waitBand(period)] / 60 : 0;
}

/** Rest penalty for a single edge, used only to steer routing (barriers are computed per stretch). */
function edgeRestHint(edge: PathEdge, persona: Persona): number {
  if (isSeated(edge, persona) || edge.lengthM <= persona.maxContinuousWalkM) return 0;
  return persona.restPenaltyMin * Math.floor(edge.lengthM / persona.maxContinuousWalkM);
}

/** Generalised cost in minutes used by the router. Infinity = impassable. */
export function edgeRoutingCost(
  edge: PathEdge,
  persona: Persona,
  period: Period,
  options: { ignoreStepFree?: boolean } = {},
): number {
  if (persona.requiresStepFree && !edge.stepFree && !options.ignoreStepFree) return Infinity;
  return edgeWalkMin(edge, persona, period) + edgeCrossingWaitMin(edge, period) + edgeRestHint(edge, persona);
}

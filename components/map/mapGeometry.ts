import type { Barrier, DayResult, LegResult, Township } from "@/lib/simulation/types";

export interface NumberedBarrier extends Barrier {
  n: number;
  /** Marker position after nudging overlapping markers apart. */
  pos: { x: number; y: number };
}

/** Number barriers in journey order and nudge markers off each other and off stop badges. */
export function numberBarriers(day: DayResult, avoid: { x: number; y: number }[] = []): NumberedBarrier[] {
  const taken: { x: number; y: number }[] = [...avoid];
  return day.barriers.map((b, i) => {
    const pos = { ...b.at };
    while (taken.some((p) => Math.hypot(p.x - pos.x, p.y - pos.y) < 30)) pos.x += 32;
    taken.push(pos);
    return { ...b, n: i + 1, pos };
  });
}

export function legPath(leg: LegResult): string {
  return leg.points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
}

export const sameRoute = (a: DayResult, b: DayResult) =>
  a.legs.length === b.legs.length && a.legs.every((l, i) => l.nodeIds.join() === b.legs[i]!.nodeIds.join());

export interface StopMarker {
  nodeId: string;
  x: number;
  y: number;
  label: string;
}

/** One marker per place; a place visited twice shows both stop numbers ("1·5"). */
export function stopMarkers(day: DayResult, township: Township): StopMarker[] {
  const order: string[] = [];
  const firstLeg = day.legs[0];
  if (firstLeg) order.push(firstLeg.fromNodeId);
  for (const leg of day.legs) order.push(leg.toNodeId);
  const byNode = new Map<string, number[]>();
  order.forEach((id, i) => byNode.set(id, [...(byNode.get(id) ?? []), i + 1]));
  const nodes = new Map(township.nodes.map((n) => [n.id, n]));
  return [...byNode.entries()].map(([nodeId, nums]) => {
    const n = nodes.get(nodeId);
    return { nodeId, x: n?.x ?? 0, y: n?.y ?? 0, label: nums.join("·") };
  });
}

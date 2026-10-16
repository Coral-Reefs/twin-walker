import { MODEL, isSeated } from "./cost";
import { distance } from "./graph";
import type { Barrier, PathEdge, Persona, PlaceNode } from "./types";

function midpoint(edge: PathEdge, nodes: Map<string, PlaceNode>): { x: number; y: number } {
  const a = nodes.get(edge.from);
  const b = nodes.get(edge.to);
  if (!a || !b) return { x: 0, y: 0 };
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Continuous stretches without seating that exceed the persona's comfortable limit.
 * A stretch resets at a seated edge or at a node with seating. The leg starts fresh
 * (the persona has just been at a stop).
 */
export function detectSeatingBarriers(
  legIndex: number,
  nodeIds: string[],
  edges: PathEdge[],
  persona: Persona,
  nodes: Map<string, PlaceNode>,
): Barrier[] {
  const barriers: Barrier[] = [];
  let stretch: PathEdge[] = [];
  let stretchM = 0;

  const close = () => {
    if (stretchM > persona.maxContinuousWalkM) {
      const stops = Math.floor(stretchM / persona.maxContinuousWalkM);
      const longest = stretch.reduce((a, b) => (b.lengthM > a.lengthM ? b : a));
      barriers.push({
        type: "no-seating",
        legIndex,
        edgeIds: stretch.map((e) => e.id),
        focusEdgeId: longest.id,
        at: midpoint(longest, nodes),
        extraMin: stops * persona.restPenaltyMin,
        extraM: 0,
        detail: `${Math.round(stretchM)} m with nowhere to sit along ${longest.label} (limit ${persona.maxContinuousWalkM} m)`,
      });
    }
    stretch = [];
    stretchM = 0;
  };

  edges.forEach((edge, i) => {
    if (isSeated(edge, persona)) {
      close();
    } else {
      stretch.push(edge);
      stretchM += edge.lengthM;
    }
    const nextNode = nodes.get(nodeIds[i + 1] ?? "");
    if (nextNode?.hasSeating) close();
  });
  close();
  return barriers;
}

/** Route much longer than the straight line, and the leg crosses a road. */
export function detectCrossingDetour(
  legIndex: number,
  from: PlaceNode,
  to: PlaceNode,
  edges: PathEdge[],
  distanceM: number,
  persona: Persona,
  nodes: Map<string, PlaceNode>,
  metresPerUnit: number,
): Barrier | null {
  const crossing = edges.find((e) => e.crossing?.kind === "road");
  if (!crossing) return null;
  const straightM = distance(from, to) * metresPerUnit;
  const directM = straightM * MODEL.directnessFactor;
  const extraM = distanceM - directM;
  if (distanceM <= straightM * MODEL.detourRatioThreshold || extraM < MODEL.detourMinExtraM) return null;
  return {
    type: "crossing-detour",
    legIndex,
    edgeIds: [crossing.id],
    focusEdgeId: crossing.id,
    at: midpoint(crossing, nodes),
    extraMin: extraM / persona.speedMps / 60,
    extraM,
    detail: `Nearest way across is ${crossing.label}: ${Math.round(extraM)} m further than a direct route`,
  };
}

import type { PathEdge, PlaceNode, Township } from "./types";

export interface Neighbour {
  edge: PathEdge;
  to: string;
}

export type Adjacency = Map<string, Neighbour[]>;

/** Undirected adjacency list, neighbours sorted by edge id for deterministic routing. */
export function buildAdjacency(township: Township): Adjacency {
  const adj: Adjacency = new Map();
  for (const node of township.nodes) adj.set(node.id, []);
  for (const edge of township.edges) {
    adj.get(edge.from)?.push({ edge, to: edge.to });
    adj.get(edge.to)?.push({ edge, to: edge.from });
  }
  for (const list of adj.values()) list.sort((a, b) => a.edge.id.localeCompare(b.edge.id));
  return adj;
}

export function nodeIndex(township: Township): Map<string, PlaceNode> {
  return new Map(township.nodes.map((n) => [n.id, n]));
}

export interface Route {
  nodeIds: string[];
  edges: PathEdge[];
  cost: number;
}

const EPS = 1e-9;

/**
 * Dijkstra shortest path. Edges with cost Infinity are impassable.
 * Ties are broken by node id so the same input always yields the same route.
 */
export function shortestPath(
  adj: Adjacency,
  from: string,
  to: string,
  cost: (edge: PathEdge) => number,
): Route | null {
  if (!adj.has(from) || !adj.has(to)) return null;
  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, { node: string; edge: PathEdge }>();
  const done = new Set<string>();

  for (;;) {
    let current: string | null = null;
    let best = Infinity;
    for (const [id, d] of dist) {
      if (done.has(id)) continue;
      if (d < best - EPS || (Math.abs(d - best) <= EPS && current !== null && id < current)) {
        best = d;
        current = id;
      }
    }
    if (current === null || !Number.isFinite(best)) return null;
    if (current === to) break;
    done.add(current);

    for (const { edge, to: next } of adj.get(current) ?? []) {
      if (done.has(next)) continue;
      const c = cost(edge);
      if (!Number.isFinite(c)) continue;
      const candidate = best + c;
      const known = dist.get(next);
      if (known === undefined || candidate < known - EPS) {
        dist.set(next, candidate);
        prev.set(next, { node: current, edge });
      }
    }
  }

  const nodeIds: string[] = [to];
  const edges: PathEdge[] = [];
  let cursor = to;
  while (cursor !== from) {
    const step = prev.get(cursor);
    if (!step) return null;
    edges.unshift(step.edge);
    nodeIds.unshift(step.node);
    cursor = step.node;
  }
  return { nodeIds, edges, cost: dist.get(to) ?? 0 };
}

export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

import { distance } from "./graph";
import type { DesignChange, Persona, Township } from "./types";

/**
 * Integrity checks for the seed data. Returns a list of problems (empty = valid).
 * Used by tests and at load time so bad JSON fails loudly in development.
 */
export function validateModel(township: Township, personas: Persona[], designs: DesignChange[]): string[] {
  const problems: string[] = [];
  const nodeIds = new Set(township.nodes.map((n) => n.id));
  const designNodeIds = new Set(
    designs.flatMap((d) => d.patches.flatMap((p) => (p.op === "addNode" ? [p.node.id] : []))),
  );
  const nodeById = new Map(township.nodes.map((n) => [n.id, n]));

  const seenEdges = new Set<string>();
  for (const e of township.edges) {
    if (seenEdges.has(e.id)) problems.push(`duplicate edge id ${e.id}`);
    seenEdges.add(e.id);
    const a = nodeById.get(e.from);
    const b = nodeById.get(e.to);
    if (!a || !b) {
      problems.push(`edge ${e.id} references a missing node`);
      continue;
    }
    const straight = distance(a, b) * township.meta.metresPerUnit;
    if (e.lengthM + 0.5 < straight) problems.push(`edge ${e.id} is shorter (${e.lengthM} m) than the straight line (${Math.round(straight)} m)`);
    if (e.seatsPer100m < 0) problems.push(`edge ${e.id} has negative seating`);
  }

  for (const p of personas) {
    if (p.routine.length < 4 || p.routine.length > 6) problems.push(`persona ${p.id} must have 4–6 stops`);
    for (const s of p.routine) {
      if (!nodeIds.has(s.nodeId)) problems.push(`persona ${p.id} stops at unknown node ${s.nodeId}`);
    }
    if (p.speedMps <= 0) problems.push(`persona ${p.id} has non-positive speed`);
    if (p.deadline && (p.deadline.toStop >= p.routine.length || p.deadline.fromStop >= p.deadline.toStop)) {
      problems.push(`persona ${p.id} has an invalid deadline window`);
    }
  }

  for (const d of designs) {
    for (const patch of d.patches) {
      const ref =
        patch.op === "setEdge" || patch.op === "removeEdge"
          ? patch.edgeId
          : patch.op === "setNode"
            ? patch.nodeId
            : null;
      if (ref && !seenEdges.has(ref) && !nodeIds.has(ref)) problems.push(`design ${d.id} patches unknown id ${ref}`);
      if (patch.op === "addEdge") {
        const known = (id: string) => nodeIds.has(id) || designNodeIds.has(id);
        if (!known(patch.edge.from) || !known(patch.edge.to)) problems.push(`design ${d.id} adds edge with unknown node`);
      }
    }
  }
  return problems;
}

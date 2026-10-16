import type { DesignChange, PatchOp, Township } from "./types";

/** Patches run in this phase order so the result never depends on toggle order. */
const PHASES: PatchOp["op"][] = ["addNode", "addEdge", "setNode", "setEdge", "removeEdge", "relocateStop"];

function cloneTownship(t: Township): Township {
  return {
    meta: { ...t.meta },
    nodes: t.nodes.map((n) => ({ ...n, waitMin: n.waitMin ? { ...n.waitMin } : undefined })),
    edges: t.edges.map((e) => ({ ...e, crossing: e.crossing ? { ...e.crossing, waitS: { ...e.crossing.waitS } } : undefined })),
    areas: t.areas.map((a) => ({ ...a })),
    relocations: { ...t.relocations },
  };
}

function applyPatch(t: Township, patch: PatchOp, designId: string): void {
  const fail = (msg: string): never => {
    throw new Error(`Design "${designId}": ${msg}`);
  };
  switch (patch.op) {
    case "addNode":
      if (t.nodes.some((n) => n.id === patch.node.id)) fail(`node ${patch.node.id} already exists`);
      t.nodes.push({ ...patch.node });
      return;
    case "addEdge":
      if (t.edges.some((e) => e.id === patch.edge.id)) fail(`edge ${patch.edge.id} already exists`);
      t.edges.push({ ...patch.edge });
      return;
    case "setNode": {
      const i = t.nodes.findIndex((n) => n.id === patch.nodeId);
      if (i < 0) fail(`node ${patch.nodeId} not found`);
      t.nodes[i] = { ...t.nodes[i]!, ...patch.set };
      return;
    }
    case "setEdge": {
      const i = t.edges.findIndex((e) => e.id === patch.edgeId);
      if (i < 0) fail(`edge ${patch.edgeId} not found`);
      t.edges[i] = { ...t.edges[i]!, ...patch.set };
      return;
    }
    case "removeEdge": {
      const i = t.edges.findIndex((e) => e.id === patch.edgeId);
      if (i < 0) fail(`edge ${patch.edgeId} not found`);
      t.edges.splice(i, 1);
      return;
    }
    case "relocateStop":
      if (!t.nodes.some((n) => n.id === patch.toNodeId)) fail(`relocation target ${patch.toNodeId} not found`);
      t.relocations[patch.fromNodeId] = patch.toNodeId;
      return;
  }
}

/**
 * Returns a new township with the selected design changes applied.
 * Pure: the input township is never mutated. Order of `activeIds` does not matter.
 */
export function applyDesigns(base: Township, designs: DesignChange[], activeIds: readonly string[]): Township {
  const active = designs
    .filter((d) => activeIds.includes(d.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  const unknown = activeIds.filter((id) => !designs.some((d) => d.id === id));
  if (unknown.length > 0) throw new Error(`Unknown design id(s): ${unknown.join(", ")}`);

  const t = cloneTownship(base);
  for (const phase of PHASES) {
    for (const design of active) {
      for (const patch of design.patches) {
        if (patch.op === phase) applyPatch(t, patch, design.id);
      }
    }
  }
  return t;
}

import { describe, expect, it } from "vitest";
import { designs, personas, township } from "@/lib/data";
import { applyDesigns } from "../designs";
import { evaluateDesign, evaluateScenario, simulateAll } from "../compare";
import { simulateDay } from "../journey";
import type { Persona } from "../types";

const persona = (id: string): Persona => {
  const p = personas.find((x) => x.id === id);
  if (!p) throw new Error(`missing persona ${id}`);
  return p;
};
const baseline = simulateAll(township, personas);
const delta = (designId: string, personaId: string) => {
  const d = evaluateDesign(township, personas, designs, designId, baseline).deltas.find((x) => x.personaId === personaId);
  if (!d) throw new Error("missing delta");
  return d;
};

describe("applyDesigns", () => {
  it("returns an equivalent township when no design is active", () => {
    expect(applyDesigns(township, designs, [])).toEqual(township);
  });

  it("never mutates the base township", () => {
    const snapshot = JSON.stringify(township);
    applyDesigns(township, designs, designs.map((d) => d.id));
    expect(JSON.stringify(township)).toBe(snapshot);
  });

  it("gives the same result whatever order designs are toggled in", () => {
    const ids = designs.map((d) => d.id);
    const forward = simulateAll(applyDesigns(township, designs, ids), personas);
    const reverse = simulateAll(applyDesigns(township, designs, [...ids].reverse()), personas);
    expect(reverse).toEqual(forward);
  });

  it("rejects unknown design ids", () => {
    expect(() => applyDesigns(township, designs, ["teleporter"])).toThrow(/Unknown design/);
  });
});

describe("design 1 — shaded seating area", () => {
  const id = "shaded-seating";

  it("removes Uncle Tan's no-seating barrier on the way to the park", () => {
    const before = baseline.tan!.legs[0]!.barriers.filter((b) => b.type === "no-seating");
    const after = simulateDay(applyDesigns(township, designs, [id]), persona("tan")).legs[0]!.barriers;
    expect(before.length).toBe(1);
    expect(after.filter((b) => b.type === "no-seating")).toHaveLength(0);
  });

  it("returns several minutes a day to Uncle Tan and helps Mei Ling", () => {
    expect(delta(id, "tan").savedMin).toBeGreaterThan(6);
    expect(delta(id, "tan").verdict).toBe("benefits");
    expect(delta(id, "meiling").verdict).toBe("benefits");
  });

  it("leaves nobody worse off and does not touch Aisyah or Ravi", () => {
    const impact = evaluateDesign(township, personas, designs, id, baseline);
    expect(impact.losers).toEqual([]);
    expect(delta(id, "aisyah").savedMin).toBe(0);
    expect(delta(id, "ravi").savedMin).toBe(0);
  });
});

describe("design 2 — repositioned crossing", () => {
  const id = "crossing-reposition";

  it("moves the crossing from the junction to mid-block", () => {
    const t = applyDesigns(township, designs, [id]);
    expect(t.edges.some((e) => e.id === "e_cross_junction")).toBe(false);
    expect(t.edges.find((e) => e.id === "e_cross_mid")?.crossing?.kind).toBe("road");
  });

  it("removes Ravi's crossing detours and saves him several minutes", () => {
    const d = delta(id, "ravi");
    expect(baseline.ravi!.barriers.filter((b) => b.type === "crossing-detour")).toHaveLength(2);
    expect(d.barriersRemoved.filter((b) => b.type === "crossing-detour")).toHaveLength(2);
    expect(d.savedMin).toBeGreaterThan(5);
  });

  it("flags the trade-off: Uncle Tan's clinic-to-market trip gets longer", () => {
    const d = delta(id, "tan");
    expect(d.verdict).toBe("worse");
    expect(d.reason).toMatch(/Junction crossing removed/);
    const { tradeOffs } = evaluateScenario(township, personas, designs, [id]);
    expect(tradeOffs).toHaveLength(1);
    expect(tradeOffs[0]!.winners).toEqual(expect.arrayContaining(["ravi", "meiling"]));
    expect(tradeOffs[0]!.losers.map((l) => l.personaId)).toEqual(["tan"]);
  });
});

describe("design 3 — family-friendly pickup point", () => {
  const id = "family-pickup";

  it("relocates Aisyah's school stop and cuts the pickup queue", () => {
    const after = simulateDay(applyDesigns(township, designs, [id]), persona("aisyah"));
    expect(after.legs[0]!.toNodeId).toBe("pickup_family");
    expect(baseline.aisyah!.legs[0]!.queueWaitMin).toBe(7);
    expect(after.legs[0]!.queueWaitMin).toBe(2);
  });

  it("gets Aisyah onto her train within 30 minutes", () => {
    expect(baseline.aisyah!.deadline?.met).toBe(false);
    const d = delta(id, "aisyah");
    expect(d.deadlineAfter?.met).toBe(true);
    expect(d.verdict).toBe("benefits");
  });

  it("flags the trade-off: Mei Ling has to get around the pickup driveway", () => {
    const d = delta(id, "meiling");
    expect(d.verdict).toBe("worse");
    expect(d.reason).toMatch(/pickup driveway/);
    const { tradeOffs } = evaluateScenario(township, personas, designs, [id]);
    expect(tradeOffs[0]?.losers.map((l) => l.personaId)).toEqual(["meiling"]);
  });
});

describe("combinations (demo numbers)", () => {
  it("locks the demo story for Aisyah: 35 → 27 → 22 minutes", () => {
    expect(baseline.aisyah!.deadline!.actualMin).toBeCloseTo(34.9, 0);
    expect(delta("family-pickup", "aisyah").deadlineAfter!.actualMin).toBeCloseTo(27.1, 0);
    const both = evaluateScenario(township, personas, designs, ["crossing-reposition", "family-pickup"]);
    const aisyah = both.deltas.find((d) => d.personaId === "aisyah")!;
    expect(aisyah.deadlineAfter!.actualMin).toBeCloseTo(22.4, 0);
    expect(aisyah.barriersAfter).toBe(0);
  });

  it("with all three changes, everyone is better off", () => {
    const all = evaluateScenario(township, personas, designs, designs.map((d) => d.id));
    expect(all.deltas.every((d) => d.verdict === "benefits")).toBe(true);
    // Individual trade-offs are still reported so the jury sees them.
    expect(all.tradeOffs.map((t) => t.designIds.join("+"))).toEqual(["crossing-reposition", "family-pickup"]);
  });
});

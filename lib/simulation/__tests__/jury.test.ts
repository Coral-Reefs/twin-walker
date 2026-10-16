import { describe, expect, it } from "vitest";
import { designs, personas, township } from "@/lib/data";
import { evaluateDesign, simulateAll } from "../compare";
import { bordaTally, decisionRows, isValidRanking } from "../jury";

const ids = ["a", "b", "c"];

describe("bordaTally", () => {
  it("awards 3/2/1 points and counts first choices", () => {
    const t = bordaTally([["a", "b", "c"], ["b", "a", "c"], ["a", "c", "b"]], ids);
    expect(t.totalVotes).toBe(3);
    expect(t.rows.map((r) => [r.designId, r.points, r.firstChoices])).toEqual([
      ["a", 8, 2],
      ["b", 6, 1],
      ["c", 4, 0],
    ]);
    expect(t.rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1, 9);
  });

  it("ignores malformed rankings", () => {
    const t = bordaTally([["a", "a", "b"], ["a", "b"], "nope", null, ["a", "b", "z"], ["c", "b", "a"]], ids);
    expect(t.totalVotes).toBe(1);
    expect(t.rows[0]!.designId).toBe("c");
  });

  it("handles no votes without dividing by zero", () => {
    const t = bordaTally([], ids);
    expect(t.totalVotes).toBe(0);
    expect(t.rows.every((r) => r.share === 0)).toBe(true);
  });

  it("validates rankings", () => {
    expect(isValidRanking(["c", "a", "b"], ids)).toBe(true);
    expect(isValidRanking(["c", "a"], ids)).toBe(false);
  });
});

describe("decisionRows", () => {
  const baseline = simulateAll(township, personas);
  const impacts = designs.map((d) => evaluateDesign(township, personas, designs, d.id, baseline));
  const tally = bordaTally([designs.map((d) => d.id)], designs.map((d) => d.id));
  const rows = decisionRows(designs, impacts, tally);

  it("scores every criterion on a 0–100 scale", () => {
    for (const r of rows) {
      for (const v of Object.values(r.scores)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });

  it("gives the cheapest option full affordability", () => {
    const cheapest = rows.reduce((a, b) => (b.costRM < a.costRM ? b : a));
    expect(cheapest.scores.affordability).toBe(100);
  });

  it("reports winners and losers per design", () => {
    expect(rows.find((r) => r.designId === "family-pickup")!.losers).toEqual(["meiling"]);
    expect(rows.find((r) => r.designId === "shaded-seating")!.losers).toEqual([]);
  });
});

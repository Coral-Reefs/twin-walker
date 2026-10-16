import { describe, expect, it } from "vitest";
import { designs, personas, township } from "@/lib/data";
import { buildAdjacency, shortestPath } from "../graph";
import { simulateDay } from "../journey";
import { validateModel } from "../validate";
import type { Township } from "../types";

describe("seed data", () => {
  it("is internally consistent", () => {
    expect(validateModel(township, personas, designs)).toEqual([]);
  });

  it("has four personas with 4–6 stops each", () => {
    expect(personas).toHaveLength(4);
    for (const p of personas) expect(p.routine.length).toBeGreaterThanOrEqual(4);
  });
});

describe("shortestPath", () => {
  const tiny: Township = {
    meta: { name: "t", width: 10, height: 10, metresPerUnit: 1, disclaimer: "" },
    nodes: ["a", "b", "c"].map((id, i) => ({ id, label: id, kind: "junction", x: i, y: 0, hasSeating: false })),
    edges: [
      { id: "ab", from: "a", to: "b", label: "", lengthM: 1, stepFree: true, shaded: false, seatsPer100m: 0 },
      { id: "bc", from: "b", to: "c", label: "", lengthM: 1, stepFree: false, shaded: false, seatsPer100m: 0 },
      { id: "ac", from: "a", to: "c", label: "", lengthM: 5, stepFree: true, shaded: false, seatsPer100m: 0 },
    ],
    areas: [],
    relocations: {},
  };
  const adj = buildAdjacency(tiny);

  it("finds the cheapest route", () => {
    expect(shortestPath(adj, "a", "c", (e) => e.lengthM)?.nodeIds).toEqual(["a", "b", "c"]);
  });

  it("avoids impassable edges", () => {
    const route = shortestPath(adj, "a", "c", (e) => (e.stepFree ? e.lengthM : Infinity));
    expect(route?.edges.map((e) => e.id)).toEqual(["ac"]);
  });

  it("returns null when there is no route", () => {
    expect(shortestPath(adj, "a", "c", () => Infinity)).toBeNull();
  });
});

describe("simulateDay", () => {
  const meiling = personas.find((p) => p.id === "meiling")!;
  const aisyah = personas.find((p) => p.id === "aisyah")!;
  const tan = personas.find((p) => p.id === "tan")!;

  it("is deterministic", () => {
    expect(simulateDay(township, aisyah)).toEqual(simulateDay(township, aisyah));
  });

  it("keeps the wheelchair user on step-free paths and records step-free gaps", () => {
    const day = simulateDay(township, meiling);
    const stepped = new Set(township.edges.filter((e) => !e.stepFree).map((e) => e.id));
    for (const leg of day.legs) {
      expect(leg.reachable).toBe(true);
      expect(leg.edgeIds.some((id) => stepped.has(id))).toBe(false);
    }
    expect(day.barriers.some((b) => b.type === "step-free-gap")).toBe(true);
  });

  it("totals = walking + waiting + rest stops", () => {
    const day = simulateDay(township, tan);
    const { minutes, walkMin, waitMin, restMin } = day.totals;
    expect(minutes).toBeCloseTo(walkMin + waitMin + restMin, 9);
    expect(day.barriers.some((b) => b.type === "no-seating")).toBe(true);
  });

  it("measures the deadline as journey time plus time at intermediate stops", () => {
    const day = simulateDay(township, aisyah);
    const legs = day.legs.reduce((s, l) => s + l.totalMin, 0);
    const dwell = aisyah.routine[1]!.dwellMin + aisyah.routine[2]!.dwellMin;
    expect(day.deadline!.actualMin).toBeCloseTo(legs + dwell, 9);
  });
});

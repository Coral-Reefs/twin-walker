import { describe, expect, it } from "vitest";
import assumptions from "@/lib/data/assumptions.json";
import { personas, township } from "@/lib/data";
import { MODEL } from "@/lib/simulation/cost";
import { simulateDay } from "@/lib/simulation/journey";
import { buildTimeline, clockAt, positionAt } from "../timeline";

describe("journey playback timeline", () => {
  for (const persona of personas) {
    const day = simulateDay(township, persona);
    const tl = buildTimeline(day, persona.routine);

    it(`${persona.name}: the journey clock matches the simulated minutes`, () => {
      expect(tl.clockTotal).toBeCloseTo(day.totals.minutes, 9);
      expect(clockAt(tl, tl.total)).toBeCloseTo(day.totals.minutes, 9);
    });

    it(`${persona.name}: starts at the first stop and ends at the last`, () => {
      const first = day.legs[0]!.points[0]!;
      const lastLeg = day.legs[day.legs.length - 1]!;
      const last = lastLeg.points[lastLeg.points.length - 1]!;
      expect(positionAt(tl, 0)).toEqual(first);
      expect(positionAt(tl, tl.total)).toEqual(last);
      expect(tl.stopTimes).toHaveLength(persona.routine.length);
    });
  }
});

describe("assumptions panel", () => {
  it("documents every model constant", () => {
    expect(assumptions.model.map((m) => m.key).sort()).toEqual(Object.keys(MODEL).sort());
  });
});

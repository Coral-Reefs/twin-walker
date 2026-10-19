import { describe, expect, it } from "vitest";
import {
  addDays,
  applyDrag,
  barGeometry,
  dateTicks,
  defaultProjectDates,
  dependencyConflicts,
  draftFromSuggestion,
  durationDays,
  fmtDate,
  fromDay,
  monthSegments,
  timeAgo,
  timelineRange,
  toDay,
  weekdayMon,
  wouldCreateCycle,
} from "../planner";

describe("planner dates", () => {
  it("round-trips ISO dates and is unaffected by month/year boundaries", () => {
    for (const iso of ["2026-01-01", "2026-02-28", "2028-02-29", "2026-12-31", "2027-03-29"]) {
      expect(fromDay(toDay(iso))).toBe(iso);
    }
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("counts inclusive duration", () => {
    expect(durationDays({ start_date: "2026-11-02", end_date: "2026-11-02" })).toBe(1);
    expect(durationDays({ start_date: "2026-11-02", end_date: "2026-11-08" })).toBe(7);
  });

  it("knows Monday from Sunday", () => {
    expect(weekdayMon(toDay("2026-10-19"))).toBe(0); // Monday
    expect(weekdayMon(toDay("2026-10-18"))).toBe(6); // Sunday
  });

  it("formats dates and relative times", () => {
    expect(fmtDate("2026-11-02")).toBe("2 Nov 2026");
    const now = Date.parse("2026-10-18T12:00:00Z");
    expect(timeAgo("2026-10-18T11:59:50Z", now)).toBe("just now");
    expect(timeAgo("2026-10-18T11:30:00Z", now)).toBe("30 min ago");
    expect(timeAgo("2026-10-18T09:00:00Z", now)).toBe("3 h ago");
    expect(timeAgo("2026-10-16T12:00:00Z", now)).toBe("2 d ago");
    expect(timeAgo("2026-09-01T12:00:00Z", now)).toBe("1 Sep 2026");
  });

  it("default project runs next Monday for 12 weeks", () => {
    const sunday = defaultProjectDates("2026-10-18");
    expect(sunday.start).toBe("2026-10-19");
    expect(durationDays({ start_date: sunday.start, end_date: sunday.end })).toBe(84);
    const monday = defaultProjectDates("2026-10-19");
    expect(monday.start).toBe("2026-10-26"); // never starts "today"
  });
});

describe("timeline geometry", () => {
  const projects = [{ start_date: "2026-11-02", end_date: "2026-11-30" }];

  it("starts on a Monday and contains every project and today", () => {
    const r = timelineRange(projects, "2026-10-18");
    expect(weekdayMon(r.startDay)).toBe(0);
    expect(r.startDay).toBeLessThanOrEqual(toDay("2026-10-18"));
    expect(r.endDay).toBeGreaterThanOrEqual(toDay("2026-11-30"));
  });

  it("month segments tile the range exactly", () => {
    const r = timelineRange(projects, "2026-10-18");
    const px = 14;
    const segs = monthSegments(r, px);
    expect(segs[0]!.left).toBe(0);
    expect(segs.reduce((n, s) => n + s.width, 0)).toBe((r.endDay - r.startDay + 1) * px);
    segs.slice(1).forEach((s, i) => expect(s.left).toBe(segs[i]!.left + segs[i]!.width));
  });

  it("ticks: daily when zoomed in, Mondays otherwise, weekends flagged only in day view", () => {
    const r = { startDay: toDay("2026-10-19"), endDay: toDay("2026-11-01") }; // 14 days
    expect(dateTicks(r, 36)).toHaveLength(14);
    expect(dateTicks(r, 36).filter((t) => t.weekend)).toHaveLength(4);
    expect(dateTicks(r, 14)).toHaveLength(2);
    expect(dateTicks(r, 14).some((t) => t.weekend)).toBe(false);
    expect(dateTicks(r, 5).every((t) => t.label === "")).toBe(true);
  });

  it("bar geometry is relative to the range origin", () => {
    const r = { startDay: toDay("2026-10-26"), endDay: toDay("2026-12-31") };
    expect(barGeometry({ start_date: "2026-11-02", end_date: "2026-11-08" }, r, 10)).toEqual({ left: 70, width: 70 });
  });
});

describe("dragging", () => {
  const p = { start_date: "2026-11-02", end_date: "2026-11-08" };

  it("moves both ends together", () => {
    expect(applyDrag(p, "move", 3)).toEqual({ start_date: "2026-11-05", end_date: "2026-11-11" });
    expect(applyDrag(p, "move", -2)).toEqual({ start_date: "2026-10-31", end_date: "2026-11-06" });
  });

  it("resizes one end and never inverts the bar", () => {
    expect(applyDrag(p, "end", 4)).toEqual({ start_date: "2026-11-02", end_date: "2026-11-12" });
    expect(applyDrag(p, "end", -30)).toEqual({ start_date: "2026-11-02", end_date: "2026-11-02" });
    expect(applyDrag(p, "start", -3)).toEqual({ start_date: "2026-10-30", end_date: "2026-11-08" });
    expect(applyDrag(p, "start", 30)).toEqual({ start_date: "2026-11-08", end_date: "2026-11-08" });
  });
});

describe("dependencies", () => {
  const mk = (id: string, s: string, e: string, deps: string[] = []) => ({ id, start_date: s, end_date: e, depends_on: deps });

  it("flags a successor that starts on or before its predecessor's last day", () => {
    const a = mk("a", "2026-11-02", "2026-11-13");
    const ok = mk("b", "2026-11-14", "2026-11-20", ["a"]);
    const sameDay = mk("c", "2026-11-13", "2026-11-20", ["a"]);
    const early = mk("d", "2026-11-05", "2026-11-20", ["a"]);
    const byId = new Map([a, ok, sameDay, early].map((x) => [x.id, x]));
    expect(dependencyConflicts(ok, byId)).toHaveLength(0);
    expect(dependencyConflicts(sameDay, byId)).toHaveLength(1);
    expect(dependencyConflicts(early, byId)).toHaveLength(1);
  });

  it("ignores dependencies on deleted projects", () => {
    const x = mk("x", "2026-11-02", "2026-11-03", ["ghost"]);
    expect(dependencyConflicts(x, new Map([[x.id, x]]))).toHaveLength(0);
  });

  it("detects self-dependency and loops, but allows chains and diamonds", () => {
    const ps = [mk("a", "", "", []), mk("b", "", "", ["a"]), mk("c", "", "", ["b"]), mk("d", "", "", ["a", "c"])];
    expect(wouldCreateCycle(ps, "a", ["a"])).toBe(true);
    expect(wouldCreateCycle(ps, "a", ["c"])).toBe(true); // a -> c -> b -> a
    expect(wouldCreateCycle(ps, "b", ["d"])).toBe(true);
    expect(wouldCreateCycle(ps, "d", ["a", "b", "c"])).toBe(false);
    expect(wouldCreateCycle(ps, "c", ["a"])).toBe(false);
  });
});

describe("pre-filled drafts", () => {
  it("builds a short title from a suggestion", () => {
    const d = draftFromSuggestion({ body: "A shaded rest stop between home and the shops. It gets very hot at noon.", place: "Watsons" }, "2026-10-18");
    expect(d.title).toBe("A shaded rest stop between home and the shops");
    expect(d.description).toContain("Watsons");
    expect(d.start_date).toBe("2026-10-19");
  });

  it("truncates a very long first sentence", () => {
    const d = draftFromSuggestion({ body: "x".repeat(200), place: "Study area" }, "2026-10-18");
    expect(d.title!.length).toBeLessThanOrEqual(58);
    expect(d.title!.endsWith("…")).toBe(true);
  });
});

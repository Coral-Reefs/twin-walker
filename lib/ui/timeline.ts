import type { DayResult, Stop } from "@/lib/simulation/types";

export interface Pt {
  x: number;
  y: number;
}

export type WaitKind = "crossing" | "queue" | "rest" | "stop";

/** `start` is playback time; `clockStart` is journey time (stop pauses don't advance the journey clock). */
export type Segment =
  | { kind: "move"; from: Pt; to: Pt; start: number; clockStart: number; dur: number; legIndex: number }
  | { kind: "wait"; at: Pt; start: number; clockStart: number; dur: number; legIndex: number; waitKind: WaitKind; label: string };

/** Omit that keeps a union a union. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type SegmentInput = DistributiveOmit<Segment, "start" | "clockStart">;

export interface Timeline {
  segments: Segment[];
  /** Total playback length in simulated minutes (includes visual pauses at stops). */
  total: number;
  /** Total journey minutes (travel + waiting + rest), as in the metrics. */
  clockTotal: number;
  /** Playback time at which the persona is standing at each stop (index = stop index). */
  stopTimes: number[];
}

/** Visual-only pause at each stop, in simulated minutes. */
const STOP_PAUSE_MIN = 2.5;

export const SECONDS_PER_SIM_MINUTE = 0.15;

/** Turn a simulated day into a playback timeline of moves and waits. */
export function buildTimeline(day: DayResult, routine: Stop[]): Timeline {
  const segments: Segment[] = [];
  const stopTimes: number[] = [0];
  let t = 0;
  let clock = 0;
  const push = (seg: SegmentInput) => {
    if (seg.dur <= 0) return;
    segments.push({ ...seg, start: t, clockStart: clock } as Segment);
    t += seg.dur;
    if (!(seg.kind === "wait" && seg.waitKind === "stop")) clock += seg.dur;
  };

  day.legs.forEach((leg, li) => {
    for (const step of leg.steps) {
      if (step.waitMin > 0) {
        push({
          kind: "wait",
          at: step.from,
          dur: step.waitMin,
          legIndex: li,
          waitKind: "crossing",
          label: `Waiting ${step.waitMin.toFixed(1)} min at ${step.waitLabel ?? "a crossing"}`,
        });
      }
      if (step.restMin > 0) {
        const mid = { x: (step.from.x + step.to.x) / 2, y: (step.from.y + step.to.y) / 2 };
        push({ kind: "move", from: step.from, to: mid, dur: step.walkMin / 2, legIndex: li });
        push({
          kind: "wait",
          at: mid,
          dur: step.restMin,
          legIndex: li,
          waitKind: "rest",
          label: `Resting ${step.restMin.toFixed(1)} min — nowhere to sit`,
        });
        push({ kind: "move", from: mid, to: step.to, dur: step.walkMin / 2, legIndex: li });
      } else {
        push({ kind: "move", from: step.from, to: step.to, dur: step.walkMin, legIndex: li });
      }
    }
    const end = leg.points[leg.points.length - 1] ?? { x: 0, y: 0 };
    if (leg.queueWaitMin > 0) {
      push({
        kind: "wait",
        at: end,
        dur: leg.queueWaitMin,
        legIndex: li,
        waitKind: "queue",
        label: `Queueing ${leg.queueWaitMin.toFixed(1)} min at ${leg.toLabel}`,
      });
    }
    stopTimes.push(t);
    const stop = routine[li + 1];
    if (li < day.legs.length - 1) {
      push({
        kind: "wait",
        at: end,
        dur: STOP_PAUSE_MIN,
        legIndex: li,
        waitKind: "stop",
        label: `At ${leg.toLabel}${stop ? ` — ${stop.purpose.toLowerCase()}` : ""}`,
      });
    }
  });

  return { segments, total: t, clockTotal: clock, stopTimes };
}

export function segmentIndexAt(tl: Timeline, t: number): number {
  for (let i = tl.segments.length - 1; i >= 0; i--) {
    if (t >= tl.segments[i]!.start) return i;
  }
  return 0;
}

export function positionAt(tl: Timeline, t: number): Pt {
  const seg = tl.segments[segmentIndexAt(tl, t)];
  if (!seg) return { x: 0, y: 0 };
  if (seg.kind === "wait") return seg.at;
  const f = seg.dur > 0 ? Math.min(1, Math.max(0, (t - seg.start) / seg.dur)) : 1;
  return { x: seg.from.x + (seg.to.x - seg.from.x) * f, y: seg.from.y + (seg.to.y - seg.from.y) * f };
}

/** Journey minutes elapsed at playback time t. */
export function clockAt(tl: Timeline, t: number): number {
  const seg = tl.segments[segmentIndexAt(tl, t)];
  if (!seg) return 0;
  if (seg.kind === "wait" && seg.waitKind === "stop") return seg.clockStart;
  return seg.clockStart + Math.min(Math.max(0, t - seg.start), seg.dur);
}

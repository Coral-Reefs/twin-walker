"use client";

import { animate, useMotionValue, useMotionValueEvent, type AnimationPlaybackControls } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { SECONDS_PER_SIM_MINUTE, clockAt, positionAt, segmentIndexAt, type Timeline } from "@/lib/ui/timeline";

interface Options {
  /** Changing this key restarts playback from the beginning (e.g. a new persona). */
  restartKey: string;
  reducedMotion: boolean;
}

/**
 * Drives the journey avatar along a timeline with Framer Motion.
 * With reduced motion there is no continuous animation: the user steps stop-to-stop instead.
 */
export function useJourneyPlayback(timeline: Timeline, { restartKey, reducedMotion }: Options) {
  const tlRef = useRef(timeline);
  tlRef.current = timeline;
  const start = positionAt(timeline, 0);
  const t = useMotionValue(0);
  const x = useMotionValue(start.x);
  const y = useMotionValue(start.y);
  const controls = useRef<AnimationPlaybackControls | null>(null);
  const [playing, setPlaying] = useState(false);
  const [segIndex, setSegIndex] = useState(0);
  const [clock, setClock] = useState(0);
  const [atEnd, setAtEnd] = useState(false);
  const [stopIndex, setStopIndex] = useState(0);

  const sync = useCallback(
    (v: number) => {
      const p = positionAt(tlRef.current, v);
      x.set(p.x);
      y.set(p.y);
      setSegIndex(segmentIndexAt(tlRef.current, v));
      const tl = tlRef.current;
      const end = v >= tl.total - 1e-6;
      setAtEnd(end);
      // Whole minutes only, so React re-renders a few times a second rather than every frame.
      setClock(end ? tl.clockTotal : Math.floor(clockAt(tl, v)));
    },
    [x, y],
  );

  useMotionValueEvent(t, "change", sync);

  const seek = useCallback(
    (v: number) => {
      t.set(v);
      sync(v);
    },
    [t, sync],
  );

  const pause = useCallback(() => {
    controls.current?.stop();
    controls.current = null;
    setPlaying(false);
  }, []);

  const play = useCallback(() => {
    const total = tlRef.current.total;
    if (t.get() >= total - 1e-6) seek(0);
    controls.current?.stop();
    setPlaying(true);
    controls.current = animate(t, total, {
      duration: (total - t.get()) * SECONDS_PER_SIM_MINUTE,
      ease: "linear",
      onComplete: () => {
        controls.current = null;
        setPlaying(false);
      },
    });
  }, [t, seek]);

  const goToStop = useCallback(
    (index: number) => {
      pause();
      const times = tlRef.current.stopTimes;
      const i = Math.max(0, Math.min(times.length - 1, index));
      setStopIndex(i);
      seek(times[i] ?? 0);
    },
    [pause, seek],
  );

  // New persona: start from the beginning (auto-play unless reduced motion).
  useEffect(() => {
    pause();
    seek(0);
    setStopIndex(0);
    if (reducedMotion) return undefined;
    const id = window.setTimeout(play, 400);
    return () => window.clearTimeout(id);
    // Only restart when the persona (or motion preference) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartKey, reducedMotion]);

  // Same persona, new design scenario: stay at the same moment, clamped to the new length.
  useEffect(() => {
    if (controls.current) {
      play();
      return;
    }
    seek(Math.min(t.get(), timeline.total));
  }, [timeline, play, seek, t]);

  useEffect(() => () => controls.current?.stop(), []);

  return {
    x,
    y,
    playing,
    play,
    pause,
    replay: () => {
      seek(0);
      play();
    },
    nextStop: () => goToStop(stopIndex + 1),
    prevStop: () => goToStop(stopIndex - 1),
    stopIndex,
    stopCount: timeline.stopTimes.length,
    segment: timeline.segments[segIndex],
    atEnd,
    clock,
    clockTotal: timeline.clockTotal,
  };
}

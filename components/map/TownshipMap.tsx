"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { Icon, IconGlyph } from "@/components/system/Icon";
import type { DayResult, DesignChange, Persona, Township } from "@/lib/simulation/types";
import { fmtMin } from "@/lib/ui/format";
import { PERSONA_ICON, personaColor } from "@/lib/ui/styles";
import { buildTimeline } from "@/lib/ui/timeline";
import { MapLegend } from "./MapLegend";
import { AreaLabels, Areas, BarrierMarkers, DesignMarkers, MapDefs, Network, PlaceTags } from "./MapLayers";
import { legPath, numberBarriers, sameRoute, stopMarkers } from "./mapGeometry";
import { useJourneyPlayback } from "./useJourneyPlayback";

interface Props {
  base: Township;
  township: Township;
  persona: Persona;
  day: DayResult;
  baselineDay: DayResult;
  activeDesigns: DesignChange[];
}

export function TownshipMap({ base, township, persona, day, baselineDay, activeDesigns }: Props) {
  const reduced = useReducedMotion() ?? false;
  const color = personaColor(persona.id);
  const timeline = useMemo(() => buildTimeline(day, persona.routine), [day, persona.routine]);
  const playback = useJourneyPlayback(timeline, { restartKey: persona.id, reducedMotion: reduced });
  const stops = useMemo(() => stopMarkers(day, township), [day, township]);
  const barriers = useMemo(() => numberBarriers(day, stops), [day, stops]);
  const routeChanged = activeDesigns.length > 0 && !sameRoute(day, baselineDay);
  const seg = playback.segment;
  const waiting = seg?.kind === "wait" && seg.waitKind !== "stop" && (playback.playing || reduced);
  const legNo = (seg?.legIndex ?? 0) + 1;
  const { meta } = township;

  const lastLeg = day.legs[day.legs.length - 1];
  const lastStop = persona.routine[persona.routine.length - 1];
  const status = playback.atEnd
    ? `Arrived at ${lastLeg?.toLabel}${lastStop ? ` — ${lastStop.purpose.toLowerCase()}` : ""}`
    : seg
      ? seg.kind === "wait"
        ? seg.label
        : `On the way: ${day.legs[seg.legIndex]?.fromLabel} → ${day.legs[seg.legIndex]?.toLabel}`
      : "";

  return (
    <section aria-labelledby="map-heading" className="rounded-2xl border border-line bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 id="map-heading" className="flex items-center gap-2 text-base font-semibold">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ background: color }}>
            <Icon name={PERSONA_ICON[persona.icon]} size={18} />
          </span>
          {persona.name}&rsquo;s day on the township map
        </h2>
        <span className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn">Illustrative layout</span>
      </div>

      <div
        className="overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label="Township map. On small screens, scroll sideways to see all of it."
      >
        <svg
          viewBox={`0 0 ${meta.width} ${meta.height}`}
          className="block h-auto w-full min-w-[620px]"
          role="img"
          aria-labelledby="map-svg-title map-svg-desc"
        >
          <title id="map-svg-title">{`Map of ${persona.name}'s route through the township`}</title>
          <desc id="map-svg-desc">
            {`${day.legs.length} journeys, ${fmtMin(day.totals.minutes)} of travel and waiting, ${day.totals.barrierCount} barriers. The same information is listed in text under "What the map shows".`}
          </desc>
          <MapDefs />
          <rect width={meta.width} height={meta.height} fill="#efeadf" />
          <Areas areas={township.areas} />
          <Network township={township} base={base} />
          <AreaLabels areas={township.areas} />
          <PlaceTags township={township} />

          {routeChanged &&
            baselineDay.legs.map((leg) => (
              <path
                key={`ghost-${leg.index}`}
                d={legPath(leg)}
                fill="none"
                stroke="#57534e"
                strokeWidth={4}
                strokeDasharray="8 7"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.75}
                aria-hidden="true"
              />
            ))}

          <g aria-hidden="true">
            {day.legs.map((leg) => (
              <path key={`case-${leg.index}`} d={legPath(leg)} fill="none" stroke="#ffffff" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {day.legs.map((leg) => (
              <motion.path
                key={`route-${persona.id}-${leg.index}-${leg.nodeIds.join()}`}
                d={legPath(leg)}
                fill="none"
                stroke={color}
                strokeWidth={6}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={reduced ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.7, ease: "easeInOut" }}
              />
            ))}
          </g>

          <DesignMarkers designs={activeDesigns} />
          <BarrierMarkers barriers={barriers} />

          <g aria-hidden="true">
            {stops.map((s) => {
              const w = Math.max(26, s.label.length * 9 + 10);
              return (
                <g key={s.nodeId} transform={`translate(${s.x} ${s.y})`}>
                  <rect x={-w / 2} y={-13} width={w} height={26} rx={13} fill="#ffffff" stroke={color} strokeWidth={3} />
                  <text y={5} textAnchor="middle" fontSize={14} fontWeight={800} fill="#1c1917">
                    {s.label}
                  </text>
                </g>
              );
            })}
          </g>

          <motion.g style={{ x: playback.x, y: playback.y }} aria-hidden="true">
            {waiting && <circle r={22} fill={color} className="marker-pulse" />}
            <circle r={15} fill={color} stroke="#ffffff" strokeWidth={3} />
            <IconGlyph name={PERSONA_ICON[persona.icon]} x={0} y={0} size={18} color="#ffffff" />
          </motion.g>
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
        {reduced ? (
          <div className="flex gap-2" role="group" aria-label="Step through stops">
            <button type="button" onClick={playback.prevStop} disabled={playback.stopIndex === 0} className={btn}>
              <Icon name="prev" size={16} /> Previous stop
            </button>
            <button type="button" onClick={playback.nextStop} disabled={playback.stopIndex >= playback.stopCount - 1} className={btn}>
              Next stop <Icon name="next" size={16} />
            </button>
          </div>
        ) : (
          <div className="flex gap-2" role="group" aria-label="Journey playback">
            <button type="button" onClick={playback.playing ? playback.pause : playback.play} className={btn} aria-pressed={playback.playing}>
              <Icon name={playback.playing ? "pause" : "play"} size={16} />
              {playback.playing ? "Pause" : "Play journey"}
            </button>
            <button type="button" onClick={playback.replay} className={btn}>
              <Icon name="replay" size={16} /> Replay
            </button>
          </div>
        )}
        <p className="min-w-0 flex-1 text-sm text-ink-muted">
          <span className="font-semibold text-ink">
            Journey {Math.min(legNo, day.legs.length)} of {day.legs.length}
          </span>
          {status && <> · {status}</>}
          <span className="ml-2 tabular-nums">
            (journey clock {playback.atEnd ? playback.clockTotal.toFixed(1) : playback.clock} of {playback.clockTotal.toFixed(1)} min)
          </span>
        </p>
      </div>

      <MapLegend color={color} showGhost={routeChanged} showDesigns={activeDesigns.length > 0} />
    </section>
  );
}

const btn =
  "inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50";

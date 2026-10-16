import { IconGlyph } from "@/components/system/Icon";
import type { DesignChange, MapArea, PathEdge, PlaceNode, Township } from "@/lib/simulation/types";
import { BARRIER_STYLE, DESIGN_ICON } from "@/lib/ui/styles";
import type { NumberedBarrier } from "./mapGeometry";

const AREA_STYLE: Record<MapArea["kind"], { fill: string; stroke: string }> = {
  park: { fill: "#cfe6c4", stroke: "#93bf86" },
  road: { fill: "#4b5563", stroke: "#374151" },
  rail: { fill: "#a8a29e", stroke: "#78716c" },
  building: { fill: "#e7e1d5", stroke: "#c3b9a6" },
  residential: { fill: "#e9e2f1", stroke: "#b9a9cf" },
  plaza: { fill: "#ece4d3", stroke: "#cdbf9f" },
  school: { fill: "#f6e3b4", stroke: "#d4b25a" },
  civic: { fill: "#dce7f3", stroke: "#93abc8" },
  retail: { fill: "#f4dccf", stroke: "#d4a58b" },
};

export function MapDefs() {
  return (
    <defs>
      <pattern id="zebra" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill="#4b5563" />
        <rect width="4.5" height="8" fill="#f9fafb" />
      </pattern>
      <pattern id="sleepers" width="22" height="10" patternUnits="userSpaceOnUse">
        <rect width="22" height="10" fill="#a8a29e" />
        <rect x="2" y="3" width="18" height="3" fill="#78716c" />
      </pattern>
      <pattern id="trees" width="34" height="34" patternUnits="userSpaceOnUse">
        <circle cx="9" cy="9" r="5" fill="#a9d29b" />
        <circle cx="26" cy="25" r="6" fill="#a9d29b" />
      </pattern>
      <pattern id="driveway" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="10" height="10" fill="#fde68a" />
        <rect width="4" height="10" fill="#1c1917" />
      </pattern>
    </defs>
  );
}

export function Areas({ areas }: { areas: MapArea[] }) {
  return (
    <g aria-hidden="true">
      {areas.map((a) => {
        const s = AREA_STYLE[a.kind];
        if (a.kind === "road") {
          return (
            <g key={a.id}>
              <rect x={a.x} y={a.y} width={a.w} height={a.h} fill={s.fill} />
              <line x1={a.x + a.w / 2} y1={0} x2={a.x + a.w / 2} y2={a.h} stroke="#e5e7eb" strokeWidth={2} strokeDasharray="16 14" />
              <text
                transform={`translate(${a.x + a.w / 2 + 5} ${a.h / 2 + 140}) rotate(-90)`}
                fontSize={15}
                fontWeight={600}
                fill="#ffffff"
                letterSpacing={2}
              >
                {a.label?.toUpperCase()}
              </text>
            </g>
          );
        }
        if (a.kind === "rail") {
          return (
            <g key={a.id}>
              <rect x={a.x} y={a.y} width={a.w} height={a.h} fill="url(#sleepers)" />
              <text transform={`translate(${a.x + a.w / 2 + 5} ${a.h - 40}) rotate(-90)`} fontSize={13} fontWeight={600} fill="#1c1917">
                {a.label}
              </text>
            </g>
          );
        }
        return (
          <g key={a.id}>
            <rect x={a.x} y={a.y} width={a.w} height={a.h} rx={a.kind === "park" ? 22 : 8} fill={s.fill} stroke={s.stroke} strokeWidth={2} />
            {a.kind === "park" && <rect x={a.x} y={a.y} width={a.w} height={a.h} rx={22} fill="url(#trees)" opacity={0.8} />}
          </g>
        );
      })}
    </g>
  );
}

/** Building names drawn above the paths, with a halo so routes never hide them. */
export function AreaLabels({ areas }: { areas: MapArea[] }) {
  return (
    <g aria-hidden="true">
      {areas
        .filter((a) => a.label && a.kind !== "road" && a.kind !== "rail")
        .map((a) => (
          <text
            key={a.id}
            x={a.x + 10}
            y={a.y + 20}
            fontSize={15}
            fontWeight={700}
            fill="#292524"
            stroke="#ffffff"
            strokeWidth={4}
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            {a.label}
          </text>
        ))}
    </g>
  );
}

function ends(edge: PathEdge, nodes: Map<string, PlaceNode>) {
  const a = nodes.get(edge.from);
  const b = nodes.get(edge.to);
  return a && b ? { a, b, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } } : null;
}

/** Footpaths with shade halo, seat dots and step marks. Crossings drawn on the road. */
export function Network({ township, base }: { township: Township; base: Township }) {
  const nodes = new Map(township.nodes.map((n) => [n.id, n]));
  const baseNodes = new Map(base.nodes.map((n) => [n.id, n]));
  const current = new Set(township.edges.map((e) => e.id));
  const removed = base.edges.filter((e) => !current.has(e.id));

  return (
    <g aria-hidden="true">
      {/* shade halo */}
      {township.edges.map((e) => {
        const g = ends(e, nodes);
        if (!g || !e.shaded || e.crossing?.kind === "road") return null;
        return <line key={`s-${e.id}`} x1={g.a.x} y1={g.a.y} x2={g.b.x} y2={g.b.y} stroke="#6fae6c" strokeOpacity={0.45} strokeWidth={18} strokeLinecap="round" />;
      })}
      {/* paths */}
      {township.edges.map((e) => {
        const g = ends(e, nodes);
        if (!g || e.crossing?.kind === "road") return null;
        return (
          <g key={`p-${e.id}`}>
            <line x1={g.a.x} y1={g.a.y} x2={g.b.x} y2={g.b.y} stroke="#cfc4ae" strokeWidth={9} strokeLinecap="round" />
            <line
              x1={g.a.x}
              y1={g.a.y}
              x2={g.b.x}
              y2={g.b.y}
              stroke={e.stepFree ? "#fffdf8" : "#8a7d68"}
              strokeWidth={e.stepFree ? 6 : 5}
              strokeDasharray={e.stepFree ? undefined : "3 5"}
              strokeLinecap="round"
            />
          </g>
        );
      })}
      {/* seats every ~40 m on seated paths */}
      {township.edges.map((e) => {
        const g = ends(e, nodes);
        if (!g || e.seatsPer100m < 1 || e.crossing?.kind === "road") return null;
        const len = Math.hypot(g.b.x - g.a.x, g.b.y - g.a.y);
        const count = Math.max(1, Math.floor(len / 40));
        return Array.from({ length: count }, (_, i) => {
          const f = (i + 0.5) / count;
          return (
            <rect
              key={`seat-${e.id}-${i}`}
              x={g.a.x + (g.b.x - g.a.x) * f - 3}
              y={g.a.y + (g.b.y - g.a.y) * f - 3}
              width={6}
              height={6}
              rx={1}
              fill="#5b4a2f"
            />
          );
        });
      })}
      {/* steps glyph on stepped paths */}
      {township.edges.map((e) => {
        const g = ends(e, nodes);
        if (!g || e.stepFree || e.crossing?.kind === "road") return null;
        return (
          <g key={`st-${e.id}`}>
            <circle cx={g.mid.x} cy={g.mid.y} r={10} fill="#ffffff" stroke="#57534e" strokeWidth={1.5} />
            <IconGlyph name="steps" x={g.mid.x} y={g.mid.y} size={14} color="#1c1917" strokeWidth={2.6} />
          </g>
        );
      })}
      {/* road crossings and footbridge */}
      {township.edges.map((e) => {
        const g = ends(e, nodes);
        if (!g || e.crossing?.kind !== "road") return null;
        const y = g.mid.y;
        if (!e.stepFree) {
          return (
            <g key={`c-${e.id}`}>
              <rect x={g.a.x - 4} y={y - 8} width={g.b.x - g.a.x + 8} height={16} rx={3} fill="#8a7d68" stroke="#57534e" strokeWidth={1.5} />
              <IconGlyph name="steps" x={g.a.x - 2} y={y - 22} size={16} color="#1c1917" strokeWidth={2.6} />
              <IconGlyph name="steps" x={g.b.x + 2} y={y - 22} size={16} color="#1c1917" strokeWidth={2.6} />
              <text x={g.mid.x} y={y + 28} textAnchor="middle" fontSize={12} fontWeight={600} fill="#1c1917">
                Footbridge
              </text>
            </g>
          );
        }
        // Zebra stripes on the carriageway only (path ends sit on the footpaths either side).
        return <rect key={`c-${e.id}`} x={g.a.x + 14} y={y - 10} width={g.b.x - g.a.x - 28} height={20} fill="url(#zebra)" />;
      })}
      {/* driveway conflicts */}
      {township.edges.map((e) => {
        const g = ends(e, nodes);
        if (!g || e.crossing?.kind !== "driveway") return null;
        return (
          <g key={`d-${e.id}`}>
            <rect x={g.mid.x - 14} y={g.mid.y - 8} width={28} height={16} fill="url(#driveway)" stroke="#1c1917" strokeWidth={1} />
            <text x={g.mid.x} y={g.mid.y + 26} textAnchor="middle" fontSize={11} fontWeight={600} fill="#1c1917">
              Driveway
            </text>
          </g>
        );
      })}
      {/* removed by a design change */}
      {removed.map((e) => {
        const g = ends(e, baseNodes);
        if (!g) return null;
        return (
          <g key={`r-${e.id}`}>
            <line x1={g.a.x} y1={g.a.y} x2={g.b.x} y2={g.b.y} stroke="#b91c1c" strokeWidth={3} strokeDasharray="4 4" />
            <circle cx={g.mid.x} cy={g.mid.y} r={11} fill="#ffffff" stroke="#b91c1c" strokeWidth={2} />
            <IconGlyph name="x" x={g.mid.x} y={g.mid.y} size={14} color="#b91c1c" strokeWidth={3} />
            <text x={g.mid.x} y={g.mid.y + 28} textAnchor="middle" fontSize={12} fontWeight={700} fill="#b91c1c">
              Removed
            </text>
          </g>
        );
      })}
    </g>
  );
}

const PLACE_TAGS: Record<string, string> = {
  park_s: "Steps",
  park_w: "Ramp",
  school_rear: "Rear gate",
  pickup_family: "Family pickup",
};

export function PlaceTags({ township }: { township: Township }) {
  return (
    <g aria-hidden="true">
      {township.nodes
        .filter((n) => PLACE_TAGS[n.id])
        .map((n) => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={5} fill="#ffffff" stroke="#44403c" strokeWidth={2} />
            <text x={n.x + 9} y={n.y - 8} fontSize={12} fontWeight={600} fill="#292524">
              {PLACE_TAGS[n.id]}
            </text>
          </g>
        ))}
    </g>
  );
}

export function DesignMarkers({ designs }: { designs: DesignChange[] }) {
  return (
    <g aria-hidden="true">
      {designs.map((d) => (
        <g key={d.id} transform={`translate(${d.marker.x} ${d.marker.y})`}>
          <circle r={17} fill="#0f5c4d" className="marker-pulse" />
          <circle r={17} fill="#0f5c4d" stroke="#ffffff" strokeWidth={3} />
          <IconGlyph name={DESIGN_ICON[d.icon]} x={0} y={0} size={20} color="#ffffff" />
          <rect x={-30} y={-42} width={60} height={18} rx={9} fill="#0f5c4d" />
          <text y={-29} textAnchor="middle" fontSize={11} fontWeight={700} fill="#ffffff" letterSpacing={1}>
            NEW
          </text>
        </g>
      ))}
    </g>
  );
}

function Shape({ shape, color }: { shape: "square" | "diamond" | "circle"; color: string }) {
  const common = { fill: color, stroke: "#ffffff", strokeWidth: 2.5 };
  if (shape === "square") return <rect x={-14} y={-14} width={28} height={28} rx={5} {...common} />;
  if (shape === "diamond") return <rect x={-13} y={-13} width={26} height={26} rx={3} transform="rotate(45)" {...common} />;
  return <circle r={15} {...common} />;
}

export function BarrierMarkers({ barriers }: { barriers: NumberedBarrier[] }) {
  return (
    <g aria-hidden="true">
      {barriers.map((b) => {
        const s = BARRIER_STYLE[b.type];
        return (
          <g key={`${b.type}-${b.n}`} transform={`translate(${b.pos.x} ${b.pos.y})`}>
            <Shape shape={s.shape} color={s.color} />
            <IconGlyph name={s.icon} x={0} y={0} size={17} color="#ffffff" strokeWidth={2.6} />
            <circle cx={14} cy={-14} r={9} fill="#ffffff" stroke={s.color} strokeWidth={2} />
            <text x={14} y={-10} textAnchor="middle" fontSize={11} fontWeight={800} fill="#1c1917">
              {b.n}
            </text>
          </g>
        );
      })}
    </g>
  );
}

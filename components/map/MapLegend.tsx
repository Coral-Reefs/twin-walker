import type { ReactNode } from "react";
import { IconGlyph } from "@/components/system/Icon";
import { BARRIER_STYLE } from "@/lib/ui/styles";

function Swatch({ children }: { children: ReactNode }) {
  return (
    <svg width={34} height={22} viewBox="0 0 34 22" aria-hidden="true" className="shrink-0">
      {children}
    </svg>
  );
}

export function MapLegend({ color, showGhost, showDesigns }: { color: string; showGhost: boolean; showDesigns: boolean }) {
  const items: { key: string; swatch: ReactNode; label: string }[] = [
    {
      key: "route",
      label: "Route taken",
      swatch: (
        <>
          <line x1={3} y1={11} x2={31} y2={11} stroke="#fff" strokeWidth={9} strokeLinecap="round" />
          <line x1={3} y1={11} x2={31} y2={11} stroke={color} strokeWidth={5} strokeLinecap="round" />
        </>
      ),
    },
    ...(showGhost
      ? [{ key: "ghost", label: "Today's route (before changes)", swatch: <line x1={3} y1={11} x2={31} y2={11} stroke="#57534e" strokeWidth={3} strokeDasharray="6 5" /> }]
      : []),
    {
      key: "stop",
      label: "Stop, in order",
      swatch: (
        <>
          <rect x={5} y={1} width={24} height={20} rx={10} fill="#fff" stroke={color} strokeWidth={2.5} />
          <text x={17} y={15} textAnchor="middle" fontSize={11} fontWeight={800} fill="#1c1917">
            1
          </text>
        </>
      ),
    },
    ...Object.values(BARRIER_STYLE).map((s) => ({
      key: s.label,
      label: s.label,
      swatch: (
        <g transform="translate(17 11)">
          {s.shape === "square" && <rect x={-10} y={-10} width={20} height={20} rx={4} fill={s.color} />}
          {s.shape === "diamond" && <rect x={-8} y={-8} width={16} height={16} rx={2} transform="rotate(45)" fill={s.color} />}
          {s.shape === "circle" && <circle r={10} fill={s.color} />}
          <IconGlyph name={s.icon} x={0} y={0} size={13} color="#fff" strokeWidth={2.6} />
        </g>
      ),
    })),
    {
      key: "steps",
      label: "Path with steps",
      swatch: <line x1={3} y1={11} x2={31} y2={11} stroke="#8a7d68" strokeWidth={4} strokeDasharray="3 5" strokeLinecap="round" />,
    },
    {
      key: "seats",
      label: "Seats along path",
      swatch: (
        <>
          <line x1={3} y1={11} x2={31} y2={11} stroke="#cfc4ae" strokeWidth={6} />
          <rect x={8} y={8} width={6} height={6} fill="#5b4a2f" />
          <rect x={20} y={8} width={6} height={6} fill="#5b4a2f" />
        </>
      ),
    },
    { key: "shade", label: "Shaded path", swatch: <line x1={4} y1={11} x2={30} y2={11} stroke="#6fae6c" strokeOpacity={0.55} strokeWidth={14} strokeLinecap="round" /> },
    {
      key: "zebra",
      label: "Signal crossing",
      swatch: (
        <>
          <rect x={4} y={3} width={26} height={16} fill="#4b5563" />
          {[6, 12, 18, 24].map((x) => (
            <rect key={x} x={x} y={5} width={3} height={12} fill="#f9fafb" />
          ))}
        </>
      ),
    },
    ...(showDesigns
      ? [
          {
            key: "new",
            label: "New design change",
            swatch: (
              <g transform="translate(17 11)">
                <circle r={10} fill="#0f5c4d" />
                <IconGlyph name="sparkle" x={0} y={0} size={12} color="#fff" />
              </g>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="border-t border-line px-4 py-3">
      <h3 className="sr-only">Map key</h3>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-ink sm:grid-cols-3 xl:grid-cols-4">
        {items.map((i) => (
          <li key={i.key} className="flex items-center gap-2">
            <Swatch>{i.swatch}</Swatch>
            <span>{i.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

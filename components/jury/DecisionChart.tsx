"use client";

import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useReducedMotion } from "framer-motion";
import type { DecisionRow } from "@/lib/simulation/jury";
import { DESIGN_FILL } from "./designFill";

const CRITERIA = [
  { key: "accessibility", label: "Accessibility" },
  { key: "convenience", label: "Time saved" },
  { key: "affordability", label: "Affordability" },
  { key: "preference", label: "Residents' vote" },
] as const;

export default function DecisionChart({ rows }: { rows: DecisionRow[] }) {
  const reduced = useReducedMotion() ?? false;
  const data = CRITERIA.map((c) => ({
    criterion: c.label,
    ...Object.fromEntries(rows.map((r) => [r.designId, r.scores[c.key]])),
  }));

  return (
    <div className="h-72 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 22, right: 8, bottom: 0, left: -18 }} barCategoryGap="18%">
          <CartesianGrid vertical={false} stroke="#e2dccf" />
          <XAxis dataKey="criterion" tick={{ fill: "#1c1917", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#a8a29e" }} interval={0} />
          <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fill: "#57534e", fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: "rgba(28,25,23,0.05)" }}
            formatter={(value, name) => [`${value} / 100`, rows.find((r) => r.designId === name)?.title ?? String(name)]}
          />
          <Legend
            itemSorter={null}
            formatter={(value: string) => <span style={{ color: "#1c1917", fontSize: 12 }}>{rows.find((r) => r.designId === value)?.title ?? value}</span>}
          />
          {rows.map((r) => (
            <Bar key={r.designId} dataKey={r.designId} name={r.designId} fill={`url(#fill-${r.designId})`} stroke={DESIGN_FILL[r.designId]?.color} radius={[4, 4, 0, 0]} isAnimationActive={!reduced}>
              <LabelList dataKey={r.designId} position="top" style={{ fill: "#1c1917", fontSize: 10, fontWeight: 700 }} />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

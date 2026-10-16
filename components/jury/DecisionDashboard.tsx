"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useDb } from "@/components/system/DbProvider";
import { ErrorBoundary } from "@/components/system/ErrorBoundary";
import { Icon } from "@/components/system/Icon";
import { PanelSkeleton, Skeleton } from "@/components/system/Skeleton";
import sampleVotes from "@/lib/data/sample-votes.json";
import { bordaTally, decisionRows, type DecisionRow } from "@/lib/simulation/jury";
import type { DesignChange, DesignImpact, Persona } from "@/lib/simulation/types";
import { fmtPct, fmtRM, listJoin } from "@/lib/ui/format";
import { DESIGN_FILL, DesignPatternDefs } from "./designFill";

const DecisionChart = dynamic(() => import("./DecisionChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-72 w-full" />,
});

interface Props {
  designs: DesignChange[];
  impacts: DesignImpact[];
  personas: Persona[];
}

function best(rows: DecisionRow[], pick: (r: DecisionRow) => number, lowest = false): DecisionRow | undefined {
  return [...rows].sort((a, b) => (lowest ? pick(a) - pick(b) : pick(b) - pick(a)))[0];
}

function Swatch({ designId }: { designId: string }) {
  const f = DESIGN_FILL[designId];
  return (
    <svg width={14} height={14} aria-hidden="true" className="shrink-0">
      <rect width={14} height={14} rx={3} fill={`url(#fill-${designId})`} stroke={f?.color} />
    </svg>
  );
}

export function DecisionDashboard({ designs, impacts, personas }: Props) {
  const db = useDb();
  const designIds = useMemo(() => designs.map((d) => d.id), [designs]);
  const live = db.status === "online";
  const rankings = useMemo(
    () => (live ? [...db.remoteRankings, ...db.pendingVotes.map((v) => v.ranking)] : [...sampleVotes.rankings, ...db.localRankings]),
    [live, db.remoteRankings, db.pendingVotes, db.localRankings],
  );
  const tally = useMemo(() => bordaTally(rankings, designIds), [rankings, designIds]);
  const rows = useMemo(() => decisionRows(designs, impacts, tally), [designs, impacts, tally]);
  const nameOf = (id: string) => personas.find((p) => p.id === id)?.name ?? id;

  if (db.status === "connecting" && !db.retrying) return <PanelSkeleton label="jury results" chart lines={4} />;

  const sourceLabel = live
    ? `${tally.totalVotes} live ${tally.totalVotes === 1 ? "vote" : "votes"}`
    : `${sampleVotes.rankings.length} sample votes + ${db.localRankings.length} from this device`;

  const favourite = tally.totalVotes > 0 ? rows.find((r) => r.designId === tally.rows[0]?.designId) : undefined;
  const access = best(rows, (r) => r.accessibilityGain);
  const time = best(rows, (r) => r.minutesSavedPerDay);
  const cheap = best(rows, (r) => r.costRM, true);

  return (
    <section aria-labelledby="dashboard-heading" className="relative rounded-2xl border border-line bg-card p-4 shadow-sm">
      <DesignPatternDefs />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 id="dashboard-heading" className="text-base font-semibold">
          Decision dashboard
        </h3>
        <p className={`rounded-full px-2.5 py-1 text-xs font-semibold ${live ? "bg-good-soft text-good" : "bg-warn-soft text-warn"}`}>
          {live ? <Icon name="database" size={12} className="mr-1 inline" /> : <Icon name="database-off" size={12} className="mr-1 inline" />}
          {sourceLabel}
        </p>
      </div>

      <p className="mt-2 text-sm" aria-live="polite">
        {favourite ? (
          <>
            Residents prefer <strong>{favourite.title}</strong> ({fmtPct(favourite.preferenceShare)} of ranking points).{" "}
          </>
        ) : (
          <>No votes yet — be the first juror. </>
        )}
        Biggest accessibility gain: <strong>{access?.title}</strong>. Most time saved: <strong>{time?.title}</strong>. Cheapest:{" "}
        <strong>{cheap?.title}</strong>.
      </p>

      <div className="mt-3">
        <ErrorBoundary name="decision chart">
          <DecisionChart rows={rows} />
        </ErrorBoundary>
        <p className="mt-1 text-xs text-ink-muted">
          Scores out of 100: the best option on each criterion scores 100. Affordability is inverted (cheapest = 100). Exact
          figures are in the table below.
        </p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <caption className="sr-only">Comparison of the three design changes on accessibility, time saved, cost and resident preference</caption>
          <thead>
            <tr className="text-left text-xs text-ink-muted">
              <th scope="col" className="border-b border-line px-2 py-1.5 font-semibold">
                Design change
              </th>
              <th scope="col" className="border-b border-line px-2 py-1.5 font-semibold">
                Accessibility gain
              </th>
              <th scope="col" className="border-b border-line px-2 py-1.5 font-semibold">
                Time saved
              </th>
              <th scope="col" className="border-b border-line px-2 py-1.5 font-semibold">
                Est. cost
              </th>
              <th scope="col" className="border-b border-line px-2 py-1.5 font-semibold">
                Residents&rsquo; vote
              </th>
              <th scope="col" className="border-b border-line px-2 py-1.5 font-semibold">
                Worse off
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const t = tally.rows.find((x) => x.designId === r.designId);
              return (
                <tr key={r.designId}>
                  <th scope="row" className="border-b border-line px-2 py-2 text-left font-semibold">
                    <span className="flex items-center gap-2">
                      <Swatch designId={r.designId} />
                      {r.title}
                    </span>
                  </th>
                  <td className="border-b border-line px-2 py-2 tabular-nums">
                    {r.accessibilityGain >= 0 ? "+" : "−"}
                    {Math.abs(r.accessibilityGain).toFixed(1)} min/day
                    <span className="block text-xs text-ink-muted">
                      barriers −{r.barriersRemoved} / +{r.barriersAdded}
                    </span>
                  </td>
                  <td className="border-b border-line px-2 py-2 tabular-nums">
                    {r.minutesSavedPerDay.toFixed(1)} min/day
                    <span className="block text-xs text-ink-muted">{r.hoursPerYear.toFixed(0)} h/yr</span>
                  </td>
                  <td className="border-b border-line px-2 py-2 tabular-nums">{fmtRM(r.costRM)}</td>
                  <td className="border-b border-line px-2 py-2 tabular-nums">
                    {fmtPct(r.preferenceShare)}
                    <span className="block text-xs text-ink-muted">
                      {t?.firstChoices ?? 0} first {t?.firstChoices === 1 ? "choice" : "choices"}
                    </span>
                  </td>
                  <td className="border-b border-line px-2 py-2">
                    {r.losers.length === 0 ? (
                      <span className="inline-flex items-center gap-1 font-medium text-good">
                        <Icon name="check" size={14} strokeWidth={3} /> Nobody
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-medium text-bad">
                        <Icon name="warning" size={14} /> {listJoin(r.losers.map(nameOf))}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!live && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-warn">
          <Icon name="info" size={14} className="mt-0.5 shrink-0" />
          Sample votes are illustrative and only shown while the vote database is unavailable.
        </p>
      )}
    </section>
  );
}

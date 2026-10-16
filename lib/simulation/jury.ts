import type { DesignChange, DesignImpact } from "./types";

/** A visitor's ranking: design ids, most preferred first. */
export type Ranking = string[];

export interface TallyRow {
  designId: string;
  points: number;
  firstChoices: number;
  /** Share of all Borda points, 0–1. */
  share: number;
}

export interface Tally {
  totalVotes: number;
  rows: TallyRow[];
}

/** Valid if it ranks every design exactly once. */
export function isValidRanking(ranking: unknown, designIds: readonly string[]): ranking is Ranking {
  return (
    Array.isArray(ranking) &&
    ranking.length === designIds.length &&
    new Set(ranking).size === designIds.length &&
    ranking.every((id) => typeof id === "string" && designIds.includes(id))
  );
}

/** Borda count: with n designs, 1st place earns n points, last place earns 1. Invalid rankings are ignored. */
export function bordaTally(rankings: unknown[], designIds: readonly string[]): Tally {
  const n = designIds.length;
  const points = new Map(designIds.map((id) => [id, 0]));
  const firsts = new Map(designIds.map((id) => [id, 0]));
  let totalVotes = 0;
  for (const r of rankings) {
    if (!isValidRanking(r, designIds)) continue;
    totalVotes++;
    r.forEach((id, pos) => points.set(id, (points.get(id) ?? 0) + (n - pos)));
    firsts.set(r[0]!, (firsts.get(r[0]!) ?? 0) + 1);
  }
  const totalPoints = [...points.values()].reduce((a, b) => a + b, 0);
  const rows = designIds
    .map((designId) => ({
      designId,
      points: points.get(designId) ?? 0,
      firstChoices: firsts.get(designId) ?? 0,
      share: totalPoints > 0 ? (points.get(designId) ?? 0) / totalPoints : 0,
    }))
    .sort((a, b) => b.points - a.points || a.designId.localeCompare(b.designId));
  return { totalVotes, rows };
}

export interface DecisionRow {
  designId: string;
  title: string;
  /** Net minutes per day no longer lost to barriers, across all personas. */
  accessibilityGain: number;
  barriersRemoved: number;
  barriersAdded: number;
  /** Net journey minutes returned per day across all personas. */
  minutesSavedPerDay: number;
  hoursPerYear: number;
  costRM: number;
  preferenceShare: number;
  winners: string[];
  losers: string[];
  /** 0–100 scores for the comparison chart (higher is better; cost is inverted). */
  scores: { accessibility: number; convenience: number; affordability: number; preference: number };
}

/** Normalise each criterion against the best option so the chart compares like with like. */
export function decisionRows(designs: DesignChange[], impacts: DesignImpact[], tally: Tally): DecisionRow[] {
  const rows = designs.map((d) => {
    const impact = impacts.find((i) => i.designId === d.id);
    const pref = tally.rows.find((r) => r.designId === d.id);
    return {
      designId: d.id,
      title: d.shortTitle,
      accessibilityGain: impact?.barrierMinRemoved ?? 0,
      barriersRemoved: impact?.barriersRemoved ?? 0,
      barriersAdded: impact?.barriersAdded ?? 0,
      minutesSavedPerDay: impact?.totalSavedMinPerDay ?? 0,
      hoursPerYear: impact?.totalHoursPerYear ?? 0,
      costRM: d.costRM,
      preferenceShare: pref?.share ?? 0,
      winners: impact?.winners ?? [],
      losers: impact?.losers ?? [],
    };
  });
  const maxOf = (pick: (r: (typeof rows)[number]) => number) => Math.max(0, ...rows.map(pick));
  const maxAcc = maxOf((r) => r.accessibilityGain);
  const maxConv = maxOf((r) => r.minutesSavedPerDay);
  const minCost = Math.min(...rows.map((r) => r.costRM));
  const maxPref = maxOf((r) => r.preferenceShare);
  const pct = (v: number, max: number) => (max > 0 ? Math.max(0, Math.round((v / max) * 100)) : 0);

  return rows.map((r) => ({
    ...r,
    scores: {
      accessibility: pct(r.accessibilityGain, maxAcc),
      convenience: pct(r.minutesSavedPerDay, maxConv),
      affordability: r.costRM > 0 ? Math.round((minCost / r.costRM) * 100) : 100,
      preference: pct(r.preferenceShare, maxPref),
    },
  }));
}

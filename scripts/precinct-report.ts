// Prints the precinct-wide pass rate and median journey time per persona,
// each intervention alone, and all interventions combined. Output is a
// markdown table so it can be pasted into slides.
//
// Run: npm run precinct:report
import {
  homeCandidates,
  defaultStopsFor,
  options,
  precinctImpact,
  profiles,
} from "../lib/bbr/engine";

const BUDGET = 90;
const SEARCH_MIN = 4;

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
const f = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : "–");

const scenarios: { id: string; label: string; active: string[] }[] = [
  ...options.map((o) => ({ id: o.id, label: o.name, active: [o.id] })),
  {
    id: "all",
    label: "All three combined",
    active: options.map((o) => o.id),
  },
];

console.log(
  `# Precinct impact · ${homeCandidates.length} candidate homes · ${BUDGET}-minute budget\n`,
);
console.log(
  "Rows cover every persona using **their own default routine** (illustrative). Pass rate is the share of candidate homes whose simulated day finishes within the budget.\n",
);
console.log(
  "| Persona | Intervention | Pass before | Pass after | Δ pass | Median before (min) | Median after (min) | Δ median | Complete homes |",
);
console.log(
  "|---|---|---:|---:|---:|---:|---:|---:|---:|",
);
for (const persona of profiles) {
  const stops = defaultStopsFor(persona.id);
  for (const s of scenarios) {
    const r = precinctImpact(
      stops,
      persona,
      s.active,
      BUDGET,
      SEARCH_MIN,
      persona.defaultDeparture,
    );
    const dPass = r.passRateAfter - r.passRateBefore;
    const dMed = Number.isFinite(r.medianAfter) && Number.isFinite(r.medianBefore)
      ? r.medianAfter - r.medianBefore
      : NaN;
    console.log(
      `| ${persona.name} | ${s.label} | ${pct(r.passRateBefore)} | ${pct(r.passRateAfter)} | ${(dPass * 100 >= 0 ? "+" : "") + (dPass * 100).toFixed(0)}pp | ${f(r.medianBefore)} | ${f(r.medianAfter)} | ${Number.isFinite(dMed) ? (dMed <= 0 ? "" : "+") + dMed.toFixed(1) : "–"} | ${r.completeHomes}/${homeCandidates.length} |`,
    );
  }
}
console.log(
  "\n_Candidate homes are every 7th OSM residential-road node inside the study bbox — an illustrative sample, not a resident address list. Interventions are illustrative scenarios applied to the modelled walking network._",
);

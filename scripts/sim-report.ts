// Prints the simulation results for every persona and design combination.
// Run: npm run sim:report
import { designs, personas, township } from "../lib/data";
import { evaluateDesign, evaluateScenario, simulateAll, validateModel } from "../lib/simulation";

const problems = validateModel(township, personas, designs);
if (problems.length) console.log("VALIDATION PROBLEMS:\n  " + problems.join("\n  "));

const f = (n: number) => n.toFixed(1);
const baseline = simulateAll(township, personas);

console.log("\n=== BASELINE ===");
for (const p of personas) {
  const r = baseline[p.id]!;
  console.log(
    `${p.name.padEnd(10)} ${f(r.totals.minutes)} min | walk ${f(r.totals.walkMin)} wait ${f(r.totals.waitMin)} rest ${f(r.totals.restMin)} | ${Math.round(r.totals.distanceM)} m | barriers ${r.totals.barrierCount}` +
      (r.deadline ? ` | deadline ${f(r.deadline.actualMin)}/${r.deadline.withinMin} ${r.deadline.met ? "MET" : "MISSED"}` : ""),
  );
  for (const l of r.legs) {
    console.log(
      `   ${l.fromLabel} → ${l.toLabel}: ${Math.round(l.distanceM)} m, ${f(l.totalMin)} min (walk ${f(l.walkMin)} cross ${f(l.crossingWaitMin)} queue ${f(l.queueWaitMin)} rest ${f(l.restMin)})  via ${l.nodeIds.join(">")}`,
    );
    for (const b of l.barriers) console.log(`      ! ${b.type}: ${b.detail} (+${f(b.extraMin)} min)`);
  }
}

console.log("\n=== EACH DESIGN ALONE ===");
for (const d of designs) {
  const impact = evaluateDesign(township, personas, designs, d.id, baseline);
  console.log(`${d.title}: ${f(impact.totalSavedMinPerDay)} min/day, ${f(impact.totalHoursPerYear)} h/yr, barriers -${impact.barriersRemoved} +${impact.barriersAdded}, barrier-min removed ${f(impact.barrierMinRemoved)}`);
  for (const delta of impact.deltas) {
    console.log(
      `   ${delta.personaId.padEnd(8)} ${delta.verdict.padEnd(8)} saved ${f(delta.savedMin)} min (${f(delta.savedHoursPerYear)} h/yr) barriers ${delta.barriersBefore}→${delta.barriersAfter}` +
        (delta.deadlineAfter ? ` deadline ${f(delta.deadlineAfter.actualMin)} ${delta.deadlineAfter.met ? "MET" : "MISSED"}` : "") +
        (delta.reason ? `  [${delta.reason}]` : ""),
    );
  }
}

const combos = [
  ["crossing-reposition", "family-pickup"],
  ["shaded-seating", "crossing-reposition", "family-pickup"],
];
for (const combo of combos) {
  const s = evaluateScenario(township, personas, designs, combo);
  console.log(`\n=== COMBO ${combo.join(" + ")} ===`);
  for (const delta of s.deltas) {
    console.log(
      `   ${delta.personaId.padEnd(8)} ${delta.verdict.padEnd(8)} saved ${f(delta.savedMin)} barriers ${delta.barriersBefore}→${delta.barriersAfter}` +
        (delta.deadlineAfter ? ` deadline ${f(delta.deadlineAfter.actualMin)} ${delta.deadlineAfter.met ? "MET" : "MISSED"}` : ""),
    );
  }
  for (const t of s.tradeOffs) {
    console.log(`   TRADE-OFF [${t.designIds.join("+")}] helps ${t.winners.join(", ")}; hurts ${t.losers.map((l) => `${l.personaId} (-${f(l.lostMin)}: ${l.reason})`).join("; ")}`);
  }
}

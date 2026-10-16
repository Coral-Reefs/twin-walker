# DayZero — Bandar Bukit Raja update

**Start with [START-HERE.md](START-HERE.md) for the current app, setup, verification and modelling limits.** The active homepage is now the Bandar Bukit Raja map workspace. The documentation below describes the retained original fictional-township prototype; its headline numbers, Supabase flow and UI descriptions do not describe the new homepage.

---

## Original prototype documentation

Architects simulate buildings, traffic and sunlight, but not the everyday effort a neighbourhood asks of the people who live in it. DayZero follows four future residents through an **illustrative township**, shows where their day costs them time and where they hit barriers, then lets visitors try design changes and vote on which to fund first.

> **Illustrative assumptions only.** The township is fictional and only *inspired by* a 30-acre mixed-use masterplan (SJCC East One, Sime Darby Property). Nothing here is real project data. Every parameter is listed in the in-app **Assumptions** panel with a source label.

## What's in the MVP

1. **Day-in-the-Life Simulator.** Four personas (working parent, night-shift worker, wheelchair user, retired walking-aid user), each with 4–5 stops. A custom SVG map animates their journeys, pausing where they queue, wait at crossings or stop to rest. Metrics per persona: journey minutes, distance, waiting time and barriers.
2. **Time Returned by Design.** Three toggleable changes (shaded seating area, repositioned crossing, family-friendly pickup point). Every resident's day is recalculated instantly, with minutes saved, hours per year and trade-off flags when a change helps one group but costs another.
3. **Resident Design Jury.** Visitors rank the three changes. The decision dashboard compares accessibility gain, time saved, illustrative cost and resident preference.

## Quick start

Requires **Node 20+** (tested on Node 24) and npm.

```bash
npm install
npm run dev          # http://localhost:3000
```

With no environment variables the app runs in **Demo mode**: everything works on local JSON, and jury votes are kept on the device alongside clearly labelled sample votes.

```bash
npm test             # 40 unit tests (simulation engine, design changes, jury, playback)
npm run typecheck    # strict TypeScript
npm run build && npm start   # production build — use this for the live demo
npm run sim:report   # prints every persona × design result in the terminal
```

## Supabase (optional: live votes and analytics)

1. Create a Supabase project.
2. In the SQL editor, run `supabase/migrations/20261016000000_init.sql`. Optionally run `supabase/seed.sql` so the dashboard isn't empty at the start.
3. Copy `.env.example` to `.env.local` and fill in the project URL and **anon** key (Project Settings → API).
4. Restart `npm run dev`. The header badge should read **Live**.

| Table | Purpose | Anonymous access |
|---|---|---|
| `votes` | One ranking per anonymous session (`session_id` unique, ranking validated in SQL) | insert; select **only** `ranking`, `created_at` |
| `events` | `persona_selected`, `design_toggled`, `vote_submitted` with small JSON props | insert only |

No personal data is collected. Session ids are random UUIDs kept in `localStorage`.

**Graceful fallback.** If the database is unconfigured, unreachable or times out (5 s), the badge switches to **Offline mode** with a **Retry** button. Votes and events are queued in `localStorage` and sync automatically when the connection returns (polling every 20 s and on the browser `online` event). The dashboard then shows sample votes plus this device's votes, labelled as such. Nothing in the simulation depends on the database.

## Project structure

```
app/                      layout, page, loading skeleton, error page, global styles (Tailwind v4 tokens)
components/
  DayZeroApp.tsx          page shell, state, live announcements, analytics hooks
  map/                    TownshipMap (SVG), MapLayers, MapLegend, KeyFindings (text alternative), playback hook
  persona/                PersonaPicker (native radio group)
  metrics/                MetricsPanel, CountUp
  design/                 DesignToggles (role="switch"), TimeReturned (+ trade-off flags)
  jury/                   RankingForm (button reordering), DecisionDashboard, DecisionChart (Recharts, lazy)
  system/                 DbProvider (Supabase + offline queue), DbStatusBadge, ErrorBoundary, Skeleton, AssumptionsPanel, Icon
lib/
  simulation/             pure, deterministic engine + tests
    types.ts graph.ts cost.ts barriers.ts journey.ts designs.ts compare.ts jury.ts validate.ts
  data/                   township.json, personas.json, designs.json, assumptions.json, sample-votes.json
  supabase/               client (+ timeout), storage helpers
  ui/                     formatting, styles, playback timeline
scripts/
  build-township.mjs      regenerates township.json from coordinates (keeps edge lengths consistent with the map)
  sim-report.ts           terminal report of all results
supabase/                 migration + seed
```

## How the simulation works

All of it is pure TypeScript in `lib/simulation`, with no randomness and no I/O.

- **Township:** a graph of places (nodes) and path segments (edges). Each edge has a length, a step-free flag, a shade flag, seats per 100 m and an optional crossing with peak / off-peak / night waits. Nodes can have seating and a queue time (e.g. the school pickup gate).
- **Persona:** walking speed, longest comfortable stretch without a seat, step-free requirement, heat sensitivity, rest-stop penalty, days per year, routine of stops and an optional deadline window.
- **Routing:** Dijkstra on a per-persona cost (walk time + crossing wait + a rest hint). Ties are broken by id, so results are deterministic. Steps are impassable for step-free personas.
- **Journey time** = distance ÷ speed (×1.15 in unshaded midday heat for heat-sensitive personas) + crossing waits + queue waits + rest-stop penalties. Time spent at stops is reported separately.
- **Barriers:**
  - **No seating:** a continuous stretch without a seat that is longer than the persona's limit (150 m for Uncle Tan).
  - **Step-free gap:** the step-free route is longer than the route with steps.
  - **Crossing detour:** the route is more than 1.4× the straight line and at least 100 m longer than a direct route, and it crosses the road.
- **Design changes** are data: patch lists (`addNode`, `addEdge`, `setNode`, `setEdge`, `removeEdge`, `relocateStop`) applied in fixed phases. They never mutate the base township and give the same result whatever order they're toggled in.
- **Comparison:** each persona gets a verdict (better / worse / no change, ±0.5 min threshold), barriers removed or added, hours per year, and a plain-language reason when worse. A **trade-off** is flagged when a design has both winners and losers, on its own or in combination.
- **Jury:** Borda count (3 / 2 / 1 points). The dashboard normalises each criterion so the best option scores 100; affordability is inverted.

### Headline numbers (locked by unit tests)

| | Aisyah | Ravi | Mei Ling | Uncle Tan |
|---|---|---|---|---|
| Baseline journey minutes | 28.9 (deadline 34.9 / 30 — missed) | 31.5 | 51.7 | 72.5 |
| Shaded seating | — | — | +2.2 | **+8.2** |
| Repositioned crossing | — | +6.4 | +7.5 | **−5.7** (trade-off) |
| Family pickup point | **+7.8** (makes train: 27.1) | — | **−1.4** (trade-off) | — |
| Crossing + pickup | +12.5 (22.4 min) | +6.4 | +6.1 | −6.1 |
| All three | +12.5 | +6.4 | +7.4 | +5.5 — nobody worse off |

## Accessibility (WCAG 2.2 AA)

- Fully keyboard operable: a native radio group for personas, real `role="switch"` buttons, button-based ranking (no drag), and a native `<dialog>` for Assumptions. There's a skip link and a visible 3 px focus ring.
- No colour-only meaning. Barriers have a distinct shape, icon and label; verdicts pair an arrow icon with a word; chart series use fill patterns and the dashboard has a full data table.
- Text contrast is at least 4.5:1, checked for every text/background pair. Graphics and UI borders are at least 3:1.
- A single `aria-live` region announces metric changes after each action, e.g. "Family-friendly pickup point on. Aisyah: 21.1 minutes… Makes Home → on the 18:00 train. Trade-off: Mei Ling worse off." Count-up numbers are hidden from screen readers, which get the final value.
- `prefers-reduced-motion` is respected. There's no autoplay, and journey playback becomes **Previous stop / Next stop**. Route drawing, count-ups and chart animations are disabled.
- The map has a full text alternative ("What the map shows") listing every journey and every numbered barrier. On small screens the map scrolls inside its own focusable region, so the page itself never scrolls sideways.
- Loading skeletons, per-panel error boundaries with **Try again**, and empty states for "no design selected" and "no votes yet".

## Demo checklist (3 minutes)

**30 minutes before**
- [ ] `npm run build && npm start` on the demo laptop (production mode: faster, no dev overlay).
- [ ] Browser window at least 1280 px wide at 100% zoom, so the map stays beside the controls.
- [ ] Badge shows **Live**. If not, Demo / Offline mode is fine; say so as a feature.
- [ ] Optional: run `supabase/seed.sql` so the dashboard has votes.
- [ ] Use a fresh browser profile (or clear site data) so the jury form is ready. **Next visitor** also resets it.
- [ ] Test the fallback once: Wi-Fi off → badge turns **Offline mode** → everything still works → Wi-Fi on → **Retry**.
- [ ] Have the Assumptions panel ready for "is this real data?" questions.

**Script**
1. **0:00 — Hook.** "Architects simulate sunlight and traffic. Nobody simulates a parent's 18:00 deadline."
2. **0:20 — Aisyah (default).** Her journey plays: a 7-minute queue at the rear school gate, then the footbridge detour. Badge: *missed — 34.9 of 30 min*.
3. **0:50 — Toggle Family-friendly pickup point.** She makes the train (27.1 min). Point out the trade-off card: *Mei Ling loses 1.4 min a day getting around the pickup driveway*.
4. **1:10 — Toggle Repositioned crossing.** Aisyah is down to 22.4 min and Ravi gains 6.4 min, but *Uncle Tan loses 6.1 min* because the junction crossing near his clinic is gone.
5. **1:30 — Select Uncle Tan, toggle Shaded seating.** His rest stops disappear. The panel now reads *Together, these changes leave nobody worse off*, with about 100 hours a year returned to four residents.
6. **2:00 — Jury.** Rank, submit. The dashboard shows that the cheapest change (seating) has no losers and saves the most time, while the moved crossing has the biggest accessibility gain but a loser. "This is the conversation we want residents in before construction."
7. **2:40 — Close.** Open **Assumptions**: every number is illustrative and labelled. "Day zero is the cheapest day to fix a neighbourhood."

**If something goes wrong:** the simulation never touches the network, so a dead connection only changes the badge. If a panel fails it shows **Try again** without taking down the page. A hard refresh always restores the default state.

## Assumptions made while building

- A single page with three steps beats separate routes for a 3-minute demo.
- Personas, distances, waits and costs (RM) are fictional and illustrative. The persona's routine `time` field is the planned time of the stop, for display only.
- Voting is anonymous, with one ranking per browser session. **Next visitor** issues a new anonymous session for kiosk use.
- Accessibility gain is measured as net minutes per day no longer lost to barriers (rest stops, step-free detours, crossing detours), summed over all personas.
- Routing uses edge-local costs; continuous no-seating stretches are evaluated on the chosen path. This keeps Dijkstra exact and the model explainable.

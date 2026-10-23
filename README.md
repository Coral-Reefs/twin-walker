# DayZero — Bandar Bukit Raja

DayZero is a browser prototype that **simulates residents' daily routines on a real OpenStreetMap snapshot of Bandar Bukit Raja (BBR)** in Klang, Selangor. Four illustrative personas walk, wheel and drive the mapped network. A design-lab panel lets planners toggle three illustrative interventions and watch who gets their time back — per person, per routine, and across the whole precinct.

> Every mobility, waiting, rest, cost, shade and intervention value is an **illustrative assumption**, not measured data and not an official Sime Darby Property project parameter. The dashed rectangle on the map is our study area, not the township boundary.

## What this app does

- **Explore a day.** Pick a resident, build their routine, toggle three illustrative interventions, and watch the journey animate on the map. The dock shows total minutes, walking/wheeling distance, waiting time, assumed rest barriers and the share of the walking route that is shaded.
- **Compare impact.** The same home across four mobility profiles, each on their **own illustrative default routine** (Aisyah has a school run, Ravi does a late-night shop, Mei Ling runs errands at a chemist and supermarket, Uncle Tan does park + errands). The compare view shows who benefits from each intervention and where the trade-offs are.
- **Precinct impact.** We sample ~150 candidate "homes" from residential OSM nodes inside the study bbox and replay the active resident's routine from every one. The panel reports pass rate (% of homes finishing within a time budget, default 90 min), median journey minutes, and the before/after change. A map toggle plots pass/fail dots per home.
- **Planner-placed shaded zone.** The Design Lab lets planners click the map to place a 250 m "shaded rest-stop zone" that overrides the fixed 500 m park zone used by the Shaded rest stops intervention.
- **Resident jury.** Visitors register a device-local preference and leave suggestions. Nothing is prefilled with fake sample votes.

## How to run it

Requires **Node 20+** and npm.

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck    # strict TypeScript
npm test             # 71 unit tests, including the BBR engine and precinct metric
npm run precinct:report   # markdown table of precinct pass rates by persona × intervention
```

For a production build:

```bash
npm run build && npm start
```

## Data source and licence

The road and place geometry is a bundled OpenStreetMap snapshot retrieved on 16 October 2026 from
`https://www.openstreetmap.org/api/0.6/map?bbox=101.415,3.080,101.445,3.105` and stored at
[`lib/bbr/network.json`](lib/bbr/network.json). It contains 4,008 road/path nodes, 1,146 ways and 40 named destinations in the declared study bbox.

Data is © OpenStreetMap contributors, licensed under the Open Database Licence (ODbL): <https://www.openstreetmap.org/copyright>. Basemap tiles require internet access and are attributed on the map; the bundled road geometry stays available offline. Township photography is linked remotely from the official Sime Darby Property page and used for context only, not as evidence of route conditions.

Optional per-way shade data lives at [`lib/bbr/shade.json`](lib/bbr/shade.json) (see [`lib/bbr/SHADE.md`](lib/bbr/SHADE.md) for the format and suggested sources — ESA WorldCover, canopy-height models, or local LiDAR). The default file is empty, so with no supplied data the engine treats every edge as unshaded.

## Illustrative assumptions

Everything below is an **assumption**, listed in the in-app Assumptions panel and labelled on-screen:

- Walking/wheeling speed: 1.15 m/s (Aisyah), 1.3 m/s (Ravi), 1.0 m/s (Mei Ling), 0.8 m/s (Uncle Tan).
- Rest-barrier threshold: a continuous unshaded walk longer than the persona's limit (1200, 1500, 400, 150 m respectively).
- Driving speed: 22 km/h at 07:00–09:00 and 16:00–19:00, 30 km/h otherwise.
- Parking search time is user-set (default 4 min) plus 1 min to park, charged once per visit; the car stays where it is parked, so an intervening walk forces a return leg.
- School queue: 7 min (3 min with the family-pickup intervention). School-area pedestrian crossing: 45 s wait (15 s with the shorter-crossing intervention). Drivers gain 15 s there.
- Heat sensitivity (illustrative: Mei Ling, Uncle Tan): walking between 11:00 and 16:00 slows ×1.15 on the unshaded share of the leg.
- Shaded rest stops intervention: fully shades edges within a 500 m zone around the study park (or a 250 m zone if the planner has placed one), and removes those sections from rest-barrier accounting.
- Candidate "homes" for the precinct metric: every 7th OSM residential-road node inside the study bbox (~150 homes). This is a deterministic sample, not a resident address list.
- Two parking groups come from mapped OSM parking bays; four more are explicitly proposed/illustrative, offset from destinations for scenario testing. Fees, hours, accessible bays and legal access are unverified.

## Limitations

- The OSM snapshot's walking network has two disconnected clusters inside the bbox. The reachable "south" cluster from the two default homes contains Watsons, 99 Speedmart (south), FamilyMart (south), the school and the study park. The sole mapped clinic (Klinik Mediviron) and the mapped pharmacy (Eden) sit in the unreachable "north" cluster, so persona routines that normally include a clinic/pharmacy fall back to the nearest reachable chemist (Watsons) and supermarket. Pass rates on the precinct panel are therefore computed over the 118/150 homes whose routines complete; the other 32 sit in a disconnected residential component.
- Walking/wheeling filters known barriers (steps, `wheelchair=no`, `foot=no`) but cannot certify an accessible journey. Untagged kerbs, ramps and surfaces are not verified.
- Driving respects mapped one-way roads but does not yet model turn restrictions, live traffic or detailed junction delays.
- Route choice uses network distance. Interventions change modelled time, shade and rest burden rather than re-optimising a time-dependent route.
- Playback shows travel segments only, not activity time at stops. The dock total includes activities, waits, assumed rests and parking.
- Public transport, cycling, authoritative accessibility audits and shared jury storage are future integration work.
- Original fictional-township simulation and Supabase components remain in the source tree and their tests still run; the BBR app uses local browser storage for jury preferences.

## Main implementation

- [`components/BBRApp.tsx`](components/BBRApp.tsx) — application shell, routine editor, comparisons, precinct panel, planner tools.
- [`components/map/BBRMap.tsx`](components/map/BBRMap.tsx) — Leaflet map, markers, route layers, precinct dots, zone placement.
- [`lib/bbr/engine.ts`](lib/bbr/engine.ts) — deterministic geographic engine: Dijkstra routing, journey simulation, per-persona routines, shade/heat model, precinct impact.
- [`lib/bbr/engine.test.ts`](lib/bbr/engine.test.ts) — regression tests for routing, parking, persona routines, shade/heat behaviour, planner-placed zone and precinct metric.
- [`lib/bbr/network.json`](lib/bbr/network.json) — attributed OpenStreetMap snapshot.
- [`lib/bbr/shade.json`](lib/bbr/shade.json) + [`SHADE.md`](lib/bbr/SHADE.md) — optional per-way shade fractions.
- [`scripts/precinct-report.ts`](scripts/precinct-report.ts) — `npm run precinct:report` markdown table.
- [`app/bbr.css`](app/bbr.css) — responsive interface styling.

See [START-HERE.md](START-HERE.md) for the local-development setup note (why `node_modules` is a junction on the author's machine, how to copy to another computer).

---

## Earlier prototype

Before the BBR work, this repo shipped a **fictional-township prototype** with four personas on an SVG map, three design toggles, and a Supabase-backed resident jury. The documentation and demo script below describe that earlier prototype. Its headline numbers, Supabase flow and UI descriptions do **not** describe the current homepage.

Architects simulate buildings, traffic and sunlight, but not the everyday effort a neighbourhood asks of the people who live in it. DayZero (fictional-township version) followed four future residents through an **illustrative township**, showed where their day cost them time and where they hit barriers, then let visitors try design changes and vote on which to fund first.

> **Illustrative assumptions only.** The township was fictional and only *inspired by* a 30-acre mixed-use masterplan (SJCC East One, Sime Darby Property). Nothing was real project data. Every parameter is listed in the in-app Assumptions panel with a source label.

### What was in the earlier MVP

1. **Day-in-the-Life Simulator.** Four personas (working parent, night-shift worker, wheelchair user, retired walking-aid user), each with 4–5 stops. A custom SVG map animated their journeys, pausing where they queued, waited at crossings or stopped to rest. Metrics per persona: journey minutes, distance, waiting time and barriers.
2. **Time Returned by Design.** Three toggleable changes (shaded seating area, repositioned crossing, family-friendly pickup point). Every resident's day was recalculated instantly, with minutes saved, hours per year and trade-off flags.
3. **Resident Design Jury.** Visitors ranked the three changes. The decision dashboard compared accessibility gain, time saved, illustrative cost and resident preference.

### Earlier simulation engine

All of it was pure TypeScript in `lib/simulation`, with no randomness and no I/O.

- **Township:** a graph of places (nodes) and path segments (edges). Each edge has a length, a step-free flag, a shade flag, seats per 100 m and an optional crossing with peak / off-peak / night waits. Nodes have seating and a queue time (e.g. the school pickup gate).
- **Persona:** walking speed, longest comfortable stretch without a seat, step-free requirement, heat sensitivity, rest-stop penalty, days per year, routine of stops and an optional deadline window.
- **Routing:** Dijkstra on a per-persona cost (walk time + crossing wait + a rest hint). Ties broken by id, so results are deterministic.
- **Journey time** = distance ÷ speed (×1.15 in unshaded midday heat for heat-sensitive personas) + crossing waits + queue waits + rest-stop penalties.
- **Barriers:** no-seating stretches, step-free gaps and crossing detours.
- **Design changes** are data: patch lists applied in fixed phases. They never mutate the base township.
- **Jury:** Borda count (3 / 2 / 1 points); affordability inverted.

### Supabase (optional: live votes and analytics for the earlier prototype)

1. Create a Supabase project.
2. In the SQL editor, run `supabase/migrations/20261016000000_init.sql`. Optionally run `supabase/seed.sql`.
3. Copy `.env.example` to `.env.local` and fill in the project URL and **anon** key.
4. Restart `npm run dev`.

| Table | Purpose | Anonymous access |
|---|---|---|
| `votes` | One ranking per anonymous session | insert; select only `ranking`, `created_at` |
| `events` | `persona_selected`, `design_toggled`, `vote_submitted` with small JSON props | insert only |

If the database is unconfigured or unreachable, the earlier app falls back to **Offline mode** and queues votes in `localStorage`.

### Earlier accessibility work (WCAG 2.2 AA)

- Fully keyboard operable, no colour-only meaning, text contrast ≥ 4.5:1, an `aria-live` announcement region, `prefers-reduced-motion` respected, a full map text alternative. These apply to the earlier prototype's UI; the new BBR homepage inherits the design-system tokens but is a separate component tree.

### Earlier project structure

```
app/                      layout, page, loading skeleton, error page, global styles
components/
  DayZeroApp.tsx          earlier page shell (not the BBR homepage)
  map/                    TownshipMap (SVG), MapLayers, MapLegend, KeyFindings, playback hook
  persona/                PersonaPicker
  metrics/                MetricsPanel, CountUp
  design/                 DesignToggles, TimeReturned
  jury/                   RankingForm, DecisionDashboard, DecisionChart
  system/                 DbProvider, DbStatusBadge, ErrorBoundary, Skeleton, AssumptionsPanel, Icon
lib/
  simulation/             pure deterministic engine for the earlier prototype
  data/                   township.json, personas.json, designs.json, assumptions.json, sample-votes.json
  supabase/               client + storage helpers
  ui/                     formatting, styles, playback timeline
scripts/
  build-township.mjs      regenerates township.json from coordinates
  sim-report.ts           terminal report of all earlier-prototype results
supabase/                 migration + seed
```

### Earlier assumptions

- A single page with three steps beat separate routes for a 3-minute demo.
- Personas, distances, waits and costs (RM) were fictional and illustrative.
- Voting was anonymous, one ranking per browser session.
- Accessibility gain was measured as net minutes per day no longer lost to barriers.
- Routing used edge-local costs; continuous no-seating stretches were evaluated on the chosen path.

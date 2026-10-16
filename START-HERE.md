# DayZero — Bandar Bukit Raja

This is the updated local development copy. The original Claude project has not been edited.

## Open the app

From this directory, run:

```powershell
npm run dev -- --port 3010
```

Then open http://localhost:3010.

On this computer, `node_modules` is a directory junction to the original project's installed dependencies to avoid duplicating them on a nearly full disk. Keep that original directory available. On another computer, copy this project's source without `node_modules` or `.next`, run `npm ci`, then start the app. Leaflet 1.9.4 is vendored in `public/vendor` and does not require an additional package install.

## What changed

- Map-first desktop layout and collapsible mobile controls.
- OpenStreetMap geographic snapshot: 4,008 road/path nodes, 1,146 ways and 40 named destinations in the declared study area.
- Four fictional mobility profiles; editable home, departure, budget, destination order, activity time and travel mode per leg.
- Separate walking/wheeling and driving networks. Mapped steps, access restrictions and one-way roads are handled where applicable.
- Parking selection per driving stop, editable assumed search time, parking access walks and returning to the parked car before driving again.
- Home-return stops follow the currently selected or pinned home.
- Map markers, destination search, route playback, parking layer and baseline overlay.
- Three spatially scoped illustrative interventions, cross-profile comparisons and explicit trade-offs.
- Device-local editable jury preference and location-linked suggestions, with no fabricated sample votes.
- Remote township-context imagery attributed and linked to Sime Darby Property.

## Data and modelling limits

All mobility, waiting, rest, cost and intervention parameters are **illustrative assumptions**, not measured conditions or official Sime Darby Property project data. The map rectangle is a study boundary, not the township boundary. Some nearby destinations are outside the township itself.

The bundled OpenStreetMap snapshot was retrieved on 16 October 2026 from `https://www.openstreetmap.org/api/0.6/map?bbox=101.415,3.080,101.445,3.105`. Data is © OpenStreetMap contributors, licensed under ODbL: https://www.openstreetmap.org/copyright. Basemap tiles require internet access; the bundled road geometry remains available without them.

Two parking groups come from mapped parking bays. Four additional parking locations are explicitly **proposed/illustrative**, offset from destinations for scenario testing. They are not assertions that real public parking exists there. Availability, accessible bays, fees, hours and legal access are unverified. No live parking or traffic feed is connected.

Routes snap to nearby eligible network nodes, with approximate building/parking connectors up to 350 m. Entrances and connectors are not surveyed. Unknown wheelchair access is not treated as verified access. The app filters known barriers but cannot certify an accessible journey. Driving turn restrictions, detailed junction delays and live road closures are not yet modelled. Route selection uses network distance; interventions change modelled time/rest burden rather than optimising a time-dependent route.

Total elapsed time includes activities, travelling, crossing and queue waits, assumed rests and parking. Playback visualises travel segments, not the full activity timeline. Comparison uses the same selected routine for all profiles. The accessibility comparison reports assumed rest barriers, not a comprehensive accessibility audit.

Township photos are linked remotely from the official township page for context, not copied into the repository or used as evidence of route conditions. Confirm image reuse permission or replace with permissioned site photography before public deployment. Photography is not available for each individual destination.

The original simulation and Supabase components remain in the source and their tests still run. The new Bandar Bukit Raja jury currently uses local browser storage, not the original Supabase voting flow. Public transport, cycling, shared feedback storage and authoritative accessibility audits remain future integration work.

## Verification

TypeScript checks pass. All 48 tests pass, including eight new tests for geographic routing, parking search time, vehicle retrieval after an intervening walk, out-of-area failure, activity duration, intervention scope, deterministic scenarios and home parking.

```powershell
npm run typecheck
node node_modules/vitest/vitest.mjs run --maxWorkers=1 --no-file-parallelism
```

The development page compiled and returned HTTP 200. Browser visual inspection did not complete: the browser-control connection first timed out, and a subsequent attempt was blocked by the browser URL policy. A production build and mobile interaction verification have not been completed; available disk and memory were severely constrained. The preview was stopped to run tests. Restarting it through the agent was blocked by the approval service reporting insufficient workspace credits.

## Main implementation

- `components/BBRApp.tsx`: application shell, routine editor, comparison and jury.
- `components/map/BBRMap.tsx`: Leaflet map, markers, route layers and playback.
- `lib/bbr/engine.ts`: geographic routing and parking-aware journey calculation.
- `lib/bbr/network.json`: attributed OpenStreetMap snapshot.
- `lib/bbr/engine.test.ts`: added regression tests.
- `app/bbr.css`: responsive interface styling.

The new data layer is separate from presentation so another township can supply its own network, places and scenarios without rebuilding the interface. Before a public pilot, replace the illustrative parking/access connectors with verified entrances, audit accessibility, connect an appropriate tile provider, add route turn restrictions, and move jury feedback to shared storage.

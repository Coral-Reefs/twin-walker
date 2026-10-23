# `shade.json` — illustrative tree-shade layer

Optional per-way shade fraction loaded by `lib/bbr/engine.ts`.

**Format.** A JSON object keyed by OpenStreetMap way id (string), where the value
is the fraction of the way that is tree-shaded, between `0` (fully exposed) and
`1` (fully shaded).

```json
{
  "123456789": 0.8,
  "234567890": 0.3
}
```

Missing keys default to `0` (no shade). The default file in this repo is empty
(`{}`), so with no supplied data every edge is treated as unshaded.

**How to produce one.** Shade fractions can be estimated from any public canopy
dataset — for example ESA WorldCover 2021 (10 m), the European Space Agency
Global Canopy Height Map, or local LiDAR — by sampling each way's buffered
polygon against the canopy raster and dividing the shaded length by total
length. The values are **illustrative assumptions**, not ground-truth tree
cover, and the UI labels them as such in the Assumptions panel.

**How it is used.** For walking legs the engine computes
`shadedM = Σ edge.m · shade[way.id]`. When the "Shaded rest stops" intervention
is active, edges whose end node is within 500 m of the study park are treated
as `shade = 1`. Rest-barrier counts use the unshaded distance. For
heat-sensitive profiles (illustrative: Mei Ling, Uncle Tan) walking between
11:00 and 16:00, a ×1.15 slowdown is applied to the unshaded share of
distance.

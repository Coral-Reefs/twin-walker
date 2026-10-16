// Generates lib/data/township.json from node coordinates so edge lengths always match the map.
// Run: node scripts/build-township.mjs   (all values are illustrative assumptions)
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const node = (id, label, kind, x, y, hasSeating = false, waitMin) => ({
  id, label, kind, x, y, hasSeating, ...(waitMin ? { waitMin } : {}),
});

export const nodes = [
  // West: residential precinct
  node("park", "Central Park lawn", "park", 190, 115, true),
  node("park_s", "Park south gate (steps)", "entrance", 250, 225),
  node("park_w", "Park west gate (ramp)", "entrance", 130, 228),
  node("sp_n", "Residents' Walk (north)", "junction", 250, 262),
  node("sp_a", "Residents' Walk / Block A", "junction", 250, 330),
  node("sp_b", "Residents' Walk / School Lane", "junction", 250, 430),
  node("sp_c", "Residents' Walk / Block B", "junction", 250, 520),
  node("sp_s", "Residents' Walk (south)", "junction", 250, 640),
  node("home_a", "Block A", "home", 195, 330, true),
  node("home_b", "Block B", "home", 195, 520, true),
  node("home_c", "Block C", "home", 335, 485, true),
  node("home_d", "Block D", "home", 330, 640, true),
  node("market", "Wet Market", "market", 110, 640, true),
  node("school_rear", "School rear gate (pickup)", "school", 300, 262, false, { peak: 7, offpeak: 1, night: 0 }),
  node("sl_m", "School Lane", "junction", 400, 430),
  node("bw_n", "Boulevard west (north)", "junction", 480, 110),
  node("bw_l", "Boulevard west / School Lane", "junction", 480, 430),
  node("bw_s", "Boulevard west (junction)", "junction", 480, 580),
  // East: station & commercial precinct
  node("be_n", "Boulevard east (north)", "junction", 540, 110),
  node("be_m", "Boulevard east / Podium", "junction", 540, 300),
  node("be_l", "Boulevard east (mid)", "junction", 540, 430),
  node("be_s", "Boulevard east (junction)", "junction", 540, 580),
  node("plaza", "Station Plaza", "junction", 725, 145, true),
  node("station", "DayZero Central Station", "station", 880, 145, true),
  node("retail", "Retail Podium · Pharmacy", "pharmacy", 660, 300, true),
  node("food", "Food Hall", "food", 660, 425, true),
  node("clinic", "Community Clinic", "clinic", 660, 560, true),
];

const byId = new Map(nodes.map((n) => [n.id, n]));
const len = (a, b) => Math.ceil(Math.hypot(byId.get(a).x - byId.get(b).x, byId.get(a).y - byId.get(b).y) / 5) * 5;

const edge = (id, from, to, label, opts = {}) => ({
  id, from, to, label,
  lengthM: opts.lengthM ?? len(from, to),
  stepFree: opts.stepFree ?? true,
  shaded: opts.shaded ?? false,
  seatsPer100m: opts.seatsPer100m ?? 0,
  ...(opts.crossing ? { crossing: opts.crossing } : {}),
});

const park = { shaded: true, seatsPer100m: 2 };
const canopy = { shaded: true };

export const edges = [
  // Park
  edge("e_park_s", "park_s", "park", "Park steps & lawn path", { ...park, stepFree: false }),
  edge("e_park_w", "park_w", "park", "Park ramp & lawn path", park),
  edge("e_spn_parks", "sp_n", "park_s", "Park south approach"),
  edge("e_spn_parkw", "sp_n", "park_w", "Park edge path"),
  // Residents' Walk (the long north–south spine)
  edge("e_sp_n_a", "sp_n", "sp_a", "Residents' Walk"),
  edge("e_sp_a_b", "sp_a", "sp_b", "Residents' Walk"),
  edge("e_sp_b_c", "sp_b", "sp_c", "Residents' Walk"),
  edge("e_sp_c_s", "sp_c", "sp_s", "Residents' Walk"),
  edge("e_home_a", "home_a", "sp_a", "Block A path"),
  edge("e_home_b", "home_b", "sp_c", "Block B path"),
  edge("e_home_c_sp", "home_c", "sp_c", "Block C west path"),
  edge("e_home_c_sl", "home_c", "sl_m", "Block C north path"),
  edge("e_home_d", "home_d", "sp_s", "Block D path"),
  edge("e_home_d_e", "home_d", "bw_s", "Block D east path"),
  edge("e_market", "market", "sp_s", "Market lane"),
  edge("e_school_rear", "sp_n", "school_rear", "School rear lane"),
  // School Lane and boulevard footpaths (west)
  edge("e_sl_w", "sp_b", "sl_m", "School Lane (west)", canopy),
  edge("e_sl_e", "sl_m", "bw_l", "School Lane (east)"),
  edge("e_park_link", "sp_n", "bw_n", "Park edge path to Boulevard"),
  edge("e_bw_n_l", "bw_n", "bw_l", "Boulevard west footpath"),
  edge("e_bw_l_s", "bw_l", "bw_s", "Boulevard west footpath"),
  // Ways across Township Boulevard
  edge("e_bridge", "bw_n", "be_n", "North footbridge (stairs)", {
    lengthM: 140,
    stepFree: false,
    crossing: { kind: "road", label: "North footbridge", waitS: { peak: 0, offpeak: 0, night: 0 } },
  }),
  edge("e_cross_junction", "bw_s", "be_s", "Junction crossing", {
    crossing: { kind: "road", label: "Junction crossing", waitS: { peak: 80, offpeak: 50, night: 30 } },
  }),
  // Boulevard footpaths (east) and commercial precinct
  edge("e_be_n_m", "be_n", "be_m", "Boulevard east footpath"),
  edge("e_be_m_l", "be_m", "be_l", "Boulevard east footpath"),
  edge("e_be_l_s", "be_l", "be_s", "Boulevard east footpath"),
  edge("e_station_link", "be_n", "plaza", "Station link", canopy),
  edge("e_concourse", "plaza", "station", "Station concourse", canopy),
  edge("e_promenade", "retail", "plaza", "Covered promenade", canopy),
  edge("e_podium", "be_m", "retail", "Podium entrance"),
  edge("e_retail_food", "retail", "food", "Arcade", canopy),
  edge("e_food_l", "be_l", "food", "Food Hall forecourt"),
  edge("e_food_clinic", "food", "clinic", "Clinic walk"),
  edge("e_clinic_s", "be_s", "clinic", "Clinic forecourt"),
];

const area = (id, kind, x, y, w, h, label) => ({ id, kind, x, y, w, h, ...(label ? { label } : {}) });

export const areas = [
  area("a_park", "park", 40, 30, 300, 185, "Central Park"),
  area("a_road", "road", 492, 0, 36, 700, "Township Boulevard"),
  area("a_rail", "rail", 948, 0, 22, 700, "Rail line"),
  area("a_station", "civic", 850, 95, 92, 100, "Station"),
  area("a_plaza", "plaza", 690, 120, 150, 55),
  area("a_school", "school", 300, 280, 150, 120, "Primary School"),
  area("a_block_a", "residential", 95, 295, 85, 70, "Block A"),
  area("a_block_b", "residential", 95, 485, 85, 70, "Block B"),
  area("a_block_c", "residential", 300, 495, 130, 60, "Block C"),
  area("a_block_d", "residential", 300, 610, 130, 60, "Block D"),
  area("a_market", "retail", 40, 605, 90, 65, "Wet Market"),
  area("a_retail", "retail", 600, 250, 150, 85, "Retail Podium"),
  area("a_food", "retail", 600, 395, 150, 60, "Food Hall"),
  area("a_clinic", "civic", 600, 525, 150, 70, "Clinic"),
];

const township = {
  meta: {
    name: "DayZero Township (illustrative)",
    width: 1000,
    height: 700,
    metresPerUnit: 1,
    disclaimer:
      "Fictional township inspired by a 30-acre mixed-use masterplan. Layout, distances and waits are illustrative assumptions, not project data.",
  },
  nodes,
  edges,
  areas,
  relocations: {},
};

const out = fileURLToPath(new URL("../lib/data/township.json", import.meta.url));
writeFileSync(out, JSON.stringify(township, null, 2) + "\n");
console.log(`wrote ${nodes.length} nodes, ${edges.length} edges → ${out}`);

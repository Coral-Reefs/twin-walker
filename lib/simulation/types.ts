/**
 * Core data model for the DayZero simulation.
 * All values are illustrative assumptions — not real project data.
 */

/** Time of day a journey leg happens in. */
export type Period = "am-peak" | "midday" | "pm-peak" | "night";

/** Crossing and queue waits vary by band (am-peak and pm-peak share "peak"). */
export type WaitBand = "peak" | "offpeak" | "night";

export type NodeKind =
  | "home"
  | "school"
  | "clinic"
  | "pharmacy"
  | "station"
  | "park"
  | "market"
  | "food"
  | "junction"
  | "entrance"
  | "seating";

export interface PlaceNode {
  id: string;
  label: string;
  kind: NodeKind;
  /** Map position in SVG units (see TownshipMeta.metresPerUnit). */
  x: number;
  y: number;
  /** A place to sit at this node resets the "continuous walk" counter. */
  hasSeating: boolean;
  /** Queue time (minutes) when a persona stops here, e.g. school pickup queue. */
  waitMin?: Partial<Record<WaitBand, number>>;
}

export interface CrossingSpec {
  /** "road" crossings count towards crossing-detour barriers; "driveway" conflicts only add wait. */
  kind: "road" | "driveway";
  label: string;
  /** Average wait in seconds per band. */
  waitS: Record<WaitBand, number>;
}

export interface PathEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  /** Walking length in metres (stairs expressed as equivalent walking distance). */
  lengthM: number;
  /** False if the segment has steps / no ramp. */
  stepFree: boolean;
  /** Shade over most of the segment (trees or canopy). */
  shaded: boolean;
  /** Seats per 100 m. ≥ 1 means a seat at least every 100 m. */
  seatsPer100m: number;
  crossing?: CrossingSpec;
}

export type AreaKind =
  | "park"
  | "road"
  | "rail"
  | "building"
  | "residential"
  | "plaza"
  | "school"
  | "civic"
  | "retail";

/** Purely visual blocks for the map. Not used by the simulation. */
export interface MapArea {
  id: string;
  kind: AreaKind;
  label?: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TownshipMeta {
  name: string;
  width: number;
  height: number;
  metresPerUnit: number;
  disclaimer: string;
}

export interface Township {
  meta: TownshipMeta;
  nodes: PlaceNode[];
  edges: PathEdge[];
  areas: MapArea[];
  /** Stop relocations introduced by design changes: old node id → new node id. */
  relocations: Record<string, string>;
}

export type PersonaIcon = "parent" | "night-shift" | "wheelchair" | "walking-aid";

export interface Stop {
  nodeId: string;
  purpose: string;
  /** Display time, e.g. "17:30". */
  time: string;
  /** Period of the leg that arrives at this stop (ignored for the first stop). */
  period: Period;
  /** Time spent at the stop doing the activity (not counted as journey time). */
  dwellMin: number;
}

export interface Deadline {
  label: string;
  /** Index of the stop where the clock starts (departure). */
  fromStop: number;
  /** Index of the stop where the clock stops (arrival). */
  toStop: number;
  withinMin: number;
}

export interface Persona {
  id: string;
  name: string;
  role: string;
  summary: string;
  icon: PersonaIcon;
  /** Average walking / wheeling speed in metres per second. */
  speedMps: number;
  /** Longest comfortable distance without a seat or rest point. */
  maxContinuousWalkM: number;
  requiresStepFree: boolean;
  /** Slower in unshaded midday heat. */
  heatSensitive: boolean;
  /** Minutes lost per unplanned rest stop (standing / leaning, no seat). */
  restPenaltyMin: number;
  /** How many days a year this routine happens. */
  daysPerYear: number;
  routine: Stop[];
  deadline?: Deadline;
}

export type PatchOp =
  | { op: "addNode"; node: PlaceNode }
  | { op: "addEdge"; edge: PathEdge }
  | { op: "setNode"; nodeId: string; set: Partial<Omit<PlaceNode, "id">> }
  | { op: "setEdge"; edgeId: string; set: Partial<Omit<PathEdge, "id" | "from" | "to">> }
  | { op: "removeEdge"; edgeId: string }
  | { op: "relocateStop"; fromNodeId: string; toNodeId: string };

export type DesignIcon = "seating" | "crossing" | "pickup";

export interface DesignChange {
  id: string;
  title: string;
  shortTitle: string;
  summary: string;
  icon: DesignIcon;
  /** Illustrative capital cost in Malaysian Ringgit. */
  costRM: number;
  costNote: string;
  patches: PatchOp[];
  /** Where to draw the design marker on the map. */
  marker: { x: number; y: number };
}

// ---------- Results ----------

export type BarrierType = "no-seating" | "crossing-detour" | "step-free-gap";

export interface Barrier {
  type: BarrierType;
  legIndex: number;
  edgeIds: string[];
  /** The edge the marker sits on (for no-seating: where the rest stop happens). */
  focusEdgeId: string;
  /** Map position for the marker. */
  at: { x: number; y: number };
  /** Minutes this barrier costs (informational for detours, already inside walk time). */
  extraMin: number;
  extraM: number;
  detail: string;
}

/** One edge of a leg, for journey playback. */
export interface LegStep {
  edgeId: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  walkMin: number;
  /** Wait before starting this edge (e.g. at a crossing). */
  waitMin: number;
  waitLabel?: string;
  /** Unplanned rest stop part-way along this edge. */
  restMin: number;
}

export interface LegResult {
  index: number;
  fromNodeId: string;
  toNodeId: string;
  fromLabel: string;
  toLabel: string;
  period: Period;
  nodeIds: string[];
  edgeIds: string[];
  points: { x: number; y: number }[];
  steps: LegStep[];
  distanceM: number;
  walkMin: number;
  crossingWaitMin: number;
  queueWaitMin: number;
  restMin: number;
  totalMin: number;
  /** False when no step-free route exists and the persona is forced onto steps. */
  reachable: boolean;
  barriers: Barrier[];
}

export interface DayTotals {
  /** Journey minutes: walking + waiting + rest penalties (excludes time at stops). */
  minutes: number;
  walkMin: number;
  waitMin: number;
  restMin: number;
  distanceM: number;
  barrierCount: number;
  /** Minutes lost to barriers: rest stops without seating plus step-free and crossing detours. */
  barrierMin: number;
  dwellMin: number;
}

export interface DeadlineResult {
  label: string;
  withinMin: number;
  actualMin: number;
  met: boolean;
}

export interface DayResult {
  personaId: string;
  legs: LegResult[];
  totals: DayTotals;
  barriers: Barrier[];
  deadline?: DeadlineResult;
}

export type Verdict = "benefits" | "worse" | "neutral";

export interface PersonaDelta {
  personaId: string;
  beforeMin: number;
  afterMin: number;
  /** Positive = minutes returned to the resident. */
  savedMin: number;
  savedHoursPerYear: number;
  barriersBefore: number;
  barriersAfter: number;
  barrierMinBefore: number;
  barrierMinAfter: number;
  barriersRemoved: Barrier[];
  barriersAdded: Barrier[];
  verdict: Verdict;
  deadlineBefore?: DeadlineResult;
  deadlineAfter?: DeadlineResult;
  /** Why this persona is worse off (only for verdict "worse"). */
  reason?: string;
}

export interface DesignImpact {
  designId: string;
  deltas: PersonaDelta[];
  totalSavedMinPerDay: number;
  totalHoursPerYear: number;
  barriersRemoved: number;
  barriersAdded: number;
  /** Net minutes per day no longer lost to barriers (positive = better access). */
  barrierMinRemoved: number;
  winners: string[];
  losers: string[];
}

export interface TradeOff {
  designIds: string[];
  winners: string[];
  losers: { personaId: string; lostMin: number; reason: string }[];
}

export interface ScenarioResult {
  activeDesignIds: string[];
  baseline: Record<string, DayResult>;
  scenario: Record<string, DayResult>;
  deltas: PersonaDelta[];
  tradeOffs: TradeOff[];
}

export const fmtMin = (min: number, digits = 1) => `${min.toFixed(digits)} min`;

export const fmtSignedMin = (min: number) => `${min > 0 ? "+" : min < 0 ? "−" : "±"}${Math.abs(min).toFixed(1)} min`;

export const fmtDistance = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);

export const fmtHours = (h: number) => `${h.toFixed(1)} h`;

export const fmtRM = (rm: number) =>
  rm >= 1_000_000 ? `RM ${(rm / 1_000_000).toFixed(1)}m` : `RM ${Math.round(rm / 1000)}k`;

export const fmtPct = (share: number) => `${Math.round(share * 100)}%`;

export const PERIOD_LABEL = {
  "am-peak": "morning peak",
  midday: "midday",
  "pm-peak": "evening peak",
  night: "night",
} as const;

export function listJoin(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

import type { IconName } from "@/components/system/Icon";
import type { BarrierType, DesignIcon, PersonaIcon, Verdict } from "@/lib/simulation/types";

export const PERSONA_COLOR: Record<string, string> = {
  aisyah: "#c2410c",
  ravi: "#4338ca",
  meiling: "#0f766e",
  tan: "#a21caf",
};

export const personaColor = (id: string) => PERSONA_COLOR[id] ?? "#1c1917";

export const PERSONA_ICON: Record<PersonaIcon, IconName> = {
  parent: "parent",
  "night-shift": "night-shift",
  wheelchair: "wheelchair",
  "walking-aid": "walking-aid",
};

export const DESIGN_ICON: Record<DesignIcon, IconName> = {
  seating: "seating",
  crossing: "crossing",
  pickup: "pickup",
};

/** Barrier markers use a distinct icon, shape and word — never colour alone. */
export const BARRIER_STYLE: Record<BarrierType, { label: string; icon: IconName; color: string; shape: "square" | "diamond" | "circle" }> = {
  "no-seating": { label: "Nowhere to sit", icon: "no-seating", color: "#a14400", shape: "square" },
  "step-free-gap": { label: "Steps, no ramp", icon: "steps", color: "#6d28d9", shape: "diamond" },
  "crossing-detour": { label: "Crossing detour", icon: "detour", color: "#b91c1c", shape: "circle" },
};

export const VERDICT_STYLE: Record<Verdict, { label: string; icon: IconName; text: string; bg: string }> = {
  benefits: { label: "Better", icon: "trend-up", text: "text-good", bg: "bg-good-soft" },
  worse: { label: "Worse", icon: "trend-down", text: "text-bad", bg: "bg-bad-soft" },
  neutral: { label: "No change", icon: "minus", text: "text-ink-muted", bg: "bg-stone-100" },
};

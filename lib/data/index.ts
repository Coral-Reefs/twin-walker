import type { DesignChange, Persona, Township } from "@/lib/simulation/types";
import designsJson from "./designs.json";
import personasJson from "./personas.json";
import townshipJson from "./township.json";

// JSON imports widen string literals; the shapes are checked by validateModel in tests.
export const township = townshipJson as unknown as Township;
export const personas = personasJson as unknown as Persona[];
export const designs = designsJson as unknown as DesignChange[];

export const designIds = designs.map((d) => d.id);

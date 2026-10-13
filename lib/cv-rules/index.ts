import type { Archetype } from "@/lib/types";
import { RULES } from "./rules";
export { RULES };
export { DIMENSION_WEIGHTS, BASE_WEIGHTS } from "./profiles";
export { MYTHS } from "./myths";
export * from "./types";

export const RULES_BY_ID = new Map(RULES.map((r) => [r.id, r]));
export function rulesFor(sector: Archetype) {
  return RULES.filter((r) => r.sectors === "all" || r.sectors.includes(sector));
}

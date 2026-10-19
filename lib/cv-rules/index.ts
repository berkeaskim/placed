import type { Archetype } from "@/lib/types";
import { PLACEMENT_ADJUST, RULES, SPRING_ADJUST } from "./rules";
import type { CvRule, Track } from "./types";
export { adjustFor } from "./adjust";
export { RULES, SPRING_ADJUST, PLACEMENT_ADJUST };
export { DIMENSION_WEIGHTS, BASE_WEIGHTS, weightsFor, caveatFor } from "./profiles";
export { MYTHS } from "./myths";
export * from "./types";

export const RULES_BY_ID = new Map(RULES.map((r) => [r.id, r]));

/** Rules for a sector on a track. Track-skipped rules are dropped here, so they are never sent to the AI judge. */
export function rulesFor(sector: Archetype, track: Track = "standard"): CvRule[] {
  return RULES.filter((r) =>
    (r.sectors === "all" || r.sectors.includes(sector)) &&
    (!r.tracks || r.tracks.includes(track)) &&
    !r.trackAdjust?.[track]?.skip);
}

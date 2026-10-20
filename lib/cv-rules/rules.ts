import type { CvRule } from "./types";
import { GENERAL_RULES } from "./rules/general";
import { FINANCE_RULES } from "./rules/finance";
import { TECH_RULES } from "./rules/tech";
import { AMENDMENT_RULES } from "./rules/amendments";
import { SPRING_ADJUST, SPRING_RULES } from "./rules/spring";
import { PLACEMENT_ADJUST, PLACEMENT_RULES, SHARED_WITH_SPRING } from "./rules/placement";
import { STEM_RULES, STEM_SECTOR_ADJUST } from "./rules/stem";
import type { RuleAdjust, Track } from "./types";

export { SPRING_ADJUST, PLACEMENT_ADJUST };

/** Per-track adjustments of existing rules, each kept in its track's file so the whole policy reads in one place. */
const TRACK_ADJUST: Partial<Record<Track, Record<string, RuleAdjust>>> = { spring: SPRING_ADJUST, placement: PLACEMENT_ADJUST };

const withTracks = (r: CvRule): CvRule => {
  let out = r;
  for (const [track, adjust] of Object.entries(TRACK_ADJUST) as [Track, Record<string, RuleAdjust>][]) {
    if (adjust[r.id]) out = { ...out, trackAdjust: { ...out.trackAdjust, [track]: adjust[r.id] } };
  }
  return out;
};
/** Sector wording that lives with its sector's pack (engineering, science) merged into the shared rule's sectorAdjust. */
const withSectorPacks = (r: CvRule): CvRule => {
  const extra = (STEM_SECTOR_ADJUST as Record<string, CvRule["sectorAdjust"]>)[r.id];
  return extra ? { ...r, sectorAdjust: { ...r.sectorAdjust, ...extra } } : r;
};
const shareWithPlacement = (r: CvRule): CvRule =>
  (SHARED_WITH_SPRING as readonly string[]).includes(r.id) ? { ...r, tracks: [...(r.tracks ?? []), "placement"] } : r;

/**
 * An llm rule may return not_applicable only when its question says when (audit 04#1): "Not applicable if…" or
 * "Bonus rule: … not_applicable". Every other not_applicable from the judge becomes could_not_assess.
 */
const NA_WORDING = /not[ _]applicable/i;
const withNa = (r: CvRule): CvRule => (r.check === "llm" && !r.naAllowed && NA_WORDING.test(r.llmGuidance) ? { ...r, naAllowed: true } : r);

export const RULES: CvRule[] = [...GENERAL_RULES, ...FINANCE_RULES, ...TECH_RULES, ...AMENDMENT_RULES, ...STEM_RULES].map(withSectorPacks).map(withTracks)
  .concat(SPRING_RULES.map(shareWithPlacement), PLACEMENT_RULES).map(withNa);

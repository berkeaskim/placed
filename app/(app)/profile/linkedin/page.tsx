import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/server";
import { getProfile } from "@/lib/db/queries";
import { LI_SECTOR_IMPORTANCE } from "@/lib/linkedin-rules";
import { loadLatestLinkedInScore } from "@/lib/linkedin-score/run";
import { ARCHETYPES, type Archetype } from "@/lib/types";
import { LinkedInView } from "./linkedin-view";
import { ProfileTabs } from "../tabs";

export const metadata: Metadata = { title: "LinkedIn Score · Placed" };

/** /profile/linkedin: paste a profile link (or upload the "Save to PDF" export) and see the latest score for the target sector. */
export default async function LinkedInPage() {
  const { supabase, user } = await requireUser();
  const p = await getProfile(supabase, user.id);
  const sector: Archetype = p.target_archetype && (ARCHETYPES as readonly string[]).includes(p.target_archetype) ? p.target_archetype : "consulting";
  const latest = await loadLatestLinkedInScore(supabase, user.id, sector, LI_SECTOR_IMPORTANCE[sector]);
  return (
    <>
      <ProfileTabs active="/profile/linkedin" />
      <LinkedInView key={latest?.scoredAt ?? "none"} initial={latest} sector={sector} />
    </>
  );
}

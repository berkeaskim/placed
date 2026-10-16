import type { SupabaseClient } from "@supabase/supabase-js";
import type { IngestStore, JobRow } from "./run";
import { pgInList } from "@/lib/db/postgrest";

export function supabaseStore(db: SupabaseClient): IngestStore {
  return {
    async existing(companyId) {
      const { data, error } = await db.from("jobs").select("ext_id, content_hash, tag_status").eq("company_id", companyId);
      if (error) throw error;
      return new Map((data ?? []).map((r) => [r.ext_id as string, { content_hash: r.content_hash as string | null, tag_status: r.tag_status as string }]));
    },
    async upsert(rows: JobRow[]) {
      const { error } = await db.from("jobs").upsert(rows, { onConflict: "company_id,ext_id" });
      if (error) throw error;
    },
    async touch(companyId, extIds) {
      const { error } = await db.from("jobs").update({ last_seen: new Date().toISOString(), is_live: true, closed_at: null })
        .eq("company_id", companyId).in("ext_id", extIds);
      if (error) throw error;
    },
    async markDead(companyId, liveExtIds) {
      // closed_at = first run the posting was missing: the observed close date for ATSs that publish none.
      let q = db.from("jobs").update({ is_live: false, closed_at: new Date().toISOString() }).eq("company_id", companyId).eq("is_live", true);
      if (liveExtIds.length) q = q.not("ext_id", "in", pgInList(liveExtIds));
      const { data, error } = await q.select("id");
      if (error) throw error;
      return data?.length ?? 0;
    },
  };
}

import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { jobs, type NewJob } from "@/lib/db/schema";
import type { IngestStore, JobRow } from "./run";

/** Every JobRow column is overwritten on conflict; id and first_seen are kept. */
const UPDATE_COLS = [
  "title", "url", "location", "remote", "deadline", "deadline_source", "rolling", "closed_at", "posted_at", "archetype", "field_tags",
  "year_eligibility", "sponsors_visa", "employment_type", "first_year_friendly", "cohort_clash", "requirements", "skills", "summary",
  "raw_html", "text_lines", "fingerprint", "content_hash", "tag_status", "is_live", "last_seen",
] as const satisfies readonly (keyof JobRow & keyof NewJob)[];

const excluded = Object.fromEntries(UPDATE_COLS.map((c) => [c, sql`excluded.${sql.identifier(c)}`]));

export function sqliteStore(): IngestStore {
  return {
    async existing(companyId) {
      const rows = db.select({ ext_id: jobs.ext_id, content_hash: jobs.content_hash, tag_status: jobs.tag_status })
        .from(jobs).where(eq(jobs.company_id, companyId)).all();
      return new Map(rows.map((r) => [r.ext_id, { content_hash: r.content_hash, tag_status: r.tag_status }]));
    },
    async upsert(rows: JobRow[]) {
      db.transaction((tx) => {
        for (const r of rows) {
          tx.insert(jobs).values(r as NewJob).onConflictDoUpdate({ target: [jobs.company_id, jobs.ext_id], set: excluded }).run();
        }
      });
    },
    async touch(companyId, extIds) {
      db.update(jobs).set({ last_seen: new Date().toISOString(), is_live: true, closed_at: null })
        .where(and(eq(jobs.company_id, companyId), inArray(jobs.ext_id, extIds))).run();
    },
    async markDead(companyId, liveExtIds) {
      // closed_at = first run the posting was missing: the observed close date for ATSs that publish none.
      return db.update(jobs).set({ is_live: false, closed_at: new Date().toISOString() })
        .where(and(eq(jobs.company_id, companyId), eq(jobs.is_live, true), liveExtIds.length ? notInArray(jobs.ext_id, liveExtIds) : undefined))
        .run().changes;
    },
  };
}

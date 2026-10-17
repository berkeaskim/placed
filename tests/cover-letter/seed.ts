// DB seeding for the service and route tests: the fictional Northbridge job and Alex Morgan's CV from ./fixtures.
import { db } from "@/lib/db/client";
import { companies, cvs, jobs, profiles } from "@/lib/db/schema";
import { LOCAL_USER_ID } from "@/lib/auth/local-user";
import { FIXTURE_COMPANY, FIXTURE_CV, FIXTURE_JD_LINES, FIXTURE_ROLE } from "./fixtures";

export const U = LOCAL_USER_ID;

/** The active CV and a gamify profile for the local user (idempotent). */
export function seedStudent() {
  if (!db.select().from(profiles).all().length) db.insert(profiles).values({ user_id: U }).run();
  if (!db.select().from(cvs).all().length) {
    db.insert(cvs).values({ user_id: U, storage_path: `${U}/cv.pdf`, file_size: 1, page_count: 1, raw_text: "", parsed_json: FIXTURE_CV }).run();
  }
}

/** A fresh Northbridge job (its own company row), returning the job id. `extId` is the AI fixture key. */
export function seedNorthbridgeJob(textLines: string[] = FIXTURE_JD_LINES, extId: string = crypto.randomUUID()): string {
  const c = db.insert(companies).values({ slug: `northbridge-${crypto.randomUUID().slice(0, 8)}`, name: FIXTURE_COMPANY, ats: "greenhouse" }).returning().get();
  return db.insert(jobs).values({
    company_id: c.id, ext_id: extId, title: FIXTURE_ROLE, url: "https://example.com/job", archetype: "quant_trading", text_lines: textLines,
  }).returning().get().id;
}

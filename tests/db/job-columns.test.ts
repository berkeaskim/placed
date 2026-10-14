import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getJob, getLiveJobs } from "@/lib/db/queries";

const dbRow = {
  id: "j1", ext_id: "e1", title: "Analyst", url: "https://x", location: "London", remote: false, deadline: null, posted_at: null,
  archetype: "data_analytics", year_eligibility: [], sponsors_visa: "unknown", employment_type: "internship", first_year_friendly: true,
  cohort_clash: null, requirements: [], text_lines: [], summary: "", companies: { name: "Acme" },
};

/** Fake jobs query: fails with `missingCode` whenever the select asks for `rolling`, like a DB without migration 0004. */
function fake(opts: { rolling?: boolean; missingCode?: string; otherError?: boolean }) {
  const selects: string[] = [];
  const client = {
    from: () => ({
      select: (cols: string) => {
        selects.push(cols);
        const asksRolling = /\brolling\b/.test(cols);
        const res = opts.otherError
          ? { data: null, error: { code: "57014", message: "timeout" } }
          : asksRolling && opts.missingCode
            ? { data: null, error: { code: opts.missingCode, message: "column jobs.rolling does not exist" } }
            : { data: [{ ...dbRow, ...(asksRolling ? { rolling: opts.rolling ?? false } : {}) }], error: null };
        const q = {
          eq: () => q, or: () => q, order: () => q, limit: () => q,
          maybeSingle: async () => ({ data: res.data?.[0] ?? null, error: res.error }),
          then: (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(res).then(ok, bad),
        };
        return q;
      },
    }),
  };
  return { client: client as unknown as SupabaseClient, selects };
}

describe("job queries read `rolling` with a fallback for a DB without migration 0004", () => {
  it("returns rolling when the column exists (one query)", async () => {
    const f = fake({ rolling: true });
    const [job] = await getLiveJobs(f.client, "2026-10-14");
    expect(job.rolling).toBe(true);
    expect(f.selects).toHaveLength(1);
    expect((await getJob(fake({ rolling: true }).client, "j1"))?.rolling).toBe(true);
  });
  for (const code of ["42703", "PGRST204"]) {
    it(`retries without rolling on ${code} (column missing)`, async () => {
      const f = fake({ missingCode: code });
      const jobs = await getLiveJobs(f.client, "2026-10-14");
      expect(jobs).toHaveLength(1);
      expect(jobs[0].rolling).toBe(false);
      expect(f.selects).toHaveLength(2);
      expect(f.selects[1]).not.toMatch(/\brolling\b/);
      const g = fake({ missingCode: code });
      expect((await getJob(g.client, "j1"))?.title).toBe("Analyst");
      expect(g.selects).toHaveLength(2);
    });
  }
  it("other errors still throw (getLiveJobs) and are not retried", async () => {
    const f = fake({ otherError: true });
    await expect(getLiveJobs(f.client, "2026-10-14")).rejects.toMatchObject({ code: "57014" });
    expect(f.selects).toHaveLength(1);
  });
});

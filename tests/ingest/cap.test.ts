import { describe, it, expect, vi } from "vitest";
import { ingestCompany, type IngestStore, type JobRow } from "@/lib/ingest/run";
import type { RawJob } from "@/lib/types";
import { heuristicTagJob } from "@/lib/ai/heuristics";

const company = { id: 1, slug: "acme", name: "Acme", ats: "lever" as const, api_host: null, employer: null, transport: null, enabled: true };
const raw = (n: number): RawJob => ({
  extId: String(n), title: "Data Analyst Intern", url: `https://jobs.lever.co/acme/${n}`, location: "London",
  remote: false, html: `<h3>Requirements</h3><ul><li>SQL ${n}</li></ul>`, postedAt: null,
});

describe("per-company tag cap", () => {
  it("tags up to maxTags, stores the rest as pending, and retries pending next run", async () => {
    const upserted: JobRow[] = [];
    const store: IngestStore = {
      existing: async () => new Map(), upsert: async (r) => { upserted.push(...r); },
      touch: vi.fn(async () => {}), markDead: vi.fn(async () => 0),
    };
    const tag = vi.fn(async (i: { title: string; textLines: string[] }) => heuristicTagJob(i));
    const r = await ingestCompany(company, { fetchJobs: async () => [1, 2, 3, 4, 5].map(raw), tagJob: tag, store, maxTags: 2 });
    expect(tag).toHaveBeenCalledTimes(2);
    expect(r.tagged).toBe(2);
    expect(r.pending).toBe(3);
    expect(upserted.map((u) => u.tag_status)).toEqual(["ok", "ok", "pending", "pending", "pending"]);
    expect(r.kept).toBe(5);

    // next run: pending rows with identical content are re-tagged, ok rows are not
    const existing = new Map(upserted.map((u) => [u.ext_id, { content_hash: u.content_hash, tag_status: u.tag_status }]));
    const store2: IngestStore = { ...store, existing: async () => existing, upsert: async () => {} };
    const tag2 = vi.fn(async (i: { title: string; textLines: string[] }) => heuristicTagJob(i));
    const r2 = await ingestCompany(company, { fetchJobs: async () => [1, 2, 3, 4, 5].map(raw), tagJob: tag2, store: store2, maxTags: 2 });
    expect(tag2).toHaveBeenCalledTimes(2);
    expect(r2.pending).toBe(1);
  });
});

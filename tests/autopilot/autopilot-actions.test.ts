import { describe, it, expect, vi, beforeEach } from "vitest";
const h = vi.hoisted(() => ({ items: [] as unknown[], answers: {} as Record<string, unknown>, updates: [] as unknown[], extra: {} as Record<string, string>, completed: true }));
vi.mock("@/lib/supabase/server", () => ({ requireUser: async () => ({ supabase: {}, user: { id: "u1" } }) }));
vi.mock("@/lib/autopilot/server", () => ({
  getVault: async () => ({ core: {}, extra: h.extra, completed: h.completed }),
  buildPack: async () => ({ items: h.items, answers: h.answers }),
}));
// Update chains are awaitable at any depth, so single-.eq and double-.eq filters both work.
const chain = (): { eq: () => unknown; then: (r: (v: { error: null }) => unknown) => unknown } => ({ eq: () => chain(), then: (r) => r({ error: null }) });
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  from: (t: string) => ({
    select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { answers: h.answers, form: { url: "https://job-boards.greenhouse.io/monzo/jobs/8232726" } } }) }) }) }),
    update: (row: unknown) => { h.updates.push({ t, row }); return chain(); },
    upsert: async (row: unknown) => { h.updates.push({ t, row }); return { error: null }; },
  }),
}) }));
import { openAndFill, setAnswer, preparePack } from "@/app/(app)/jobs/[id]/autopilot-actions";

const field = (key: string, label: string) => ({ key, target: key, label, type: "select", required: true, options: [{ label: "Yes", value: "1" }] });
const JOB = "00000000-0000-4000-8000-000000000001";
const packRow = () => (h.updates.find((u) => (u as { t: string }).t === "autopilot_packs") as { row: { answers: Record<string, { value: unknown; approved?: boolean }> } }).row;

describe("autopilot actions", () => {
  beforeEach(() => { h.updates.length = 0; h.answers = {}; h.extra = {}; h.completed = true; });
  it("is locked until setup is complete", async () => {
    h.completed = false;
    expect(await preparePack(JOB)).toEqual({ locked: true });
  });
  it("refuses to open while ask/confirm items are unanswered", async () => {
    h.items = [{ field: field("q1", "Level of German?"), group: "ask", value: null, sourceLabel: null }];
    expect(await openAndFill(JOB)).toEqual({ error: expect.stringMatching(/answer/i) });
  });
  it("mints a hash-link once everything is answered", async () => {
    h.items = [{ field: field("q1", "Level of German?"), group: "ask", value: null, sourceLabel: null }];
    h.answers = { q1: { value: "1" } };
    const r = await openAndFill(JOB);
    expect(r).toMatchObject({ url: expect.stringMatching(/^https:\/\/job-boards\.greenhouse\.io\/monzo\/jobs\/8232726#placed=[A-Za-z0-9_-]{43}$/) });
    const row = (h.updates.find((u) => (u as { t: string }).t === "autopilot_packs") as { row: Record<string, unknown> }).row;
    expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.token_used_at).toBeNull();
    expect(row.status).toBe("ready");
    expect(JSON.stringify(row)).not.toContain((r as { url: string }).url.split("#placed=")[1]); // only the hash is stored
  });
  it("remembers ask-once answers but never EEO", async () => {
    await setAnswer(JOB, "q1", "1", { rememberLabel: "What's your level of German?" });
    expect(JSON.stringify(h.updates)).toContain("whats your level of german");
    h.updates.length = 0;
    await setAnswer(JOB, "q2", "x", { rememberLabel: "What is your gender?" });
    expect(JSON.stringify(h.updates)).not.toContain("gender");
  });
  it("remembers the option label (rememberText) rather than the option value", async () => {
    await setAnswer(JOB, "q1", "1", { rememberLabel: "Level of German?", rememberText: "Yes" });
    const v = h.updates.find((u) => (u as { t: string }).t === "autopilot_vault") as { row: { extra: Record<string, string> } };
    expect(v.row.extra).toEqual({ "level of german": "Yes" });
  });
  it("merges into existing answers and keeps drafts unapproved unless approved:true", async () => {
    h.answers = { other: { value: "keep", approved: true } };
    await setAnswer(JOB, "d1", "my text");
    expect(packRow().answers).toEqual({ other: { value: "keep", approved: true }, d1: { value: "my text", approved: false } });
    h.updates.length = 0;
    await setAnswer(JOB, "d1", "my text", { approved: true });
    expect(packRow().answers.d1).toEqual({ value: "my text", approved: true });
  });
  it("rejects an unknown job id", async () => {
    expect(await setAnswer("nope", "q1", "x")).toEqual({ ok: false });
    expect(await openAndFill("nope")).toEqual({ error: "Unknown job" });
  });
});

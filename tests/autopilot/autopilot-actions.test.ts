import { describe, it, expect, vi, beforeEach } from "vitest";
type F = { key: string; target: string; label: string; type: string; required: boolean; options: { label: string; value: string }[] };
const h = vi.hoisted(() => ({
  items: [] as unknown[], answers: {} as Record<string, unknown>, updates: [] as unknown[], extra: {} as Record<string, string>,
  completed: true, on: true, failTable: null as string | null, fields: [] as unknown[],
}));
vi.mock("@/lib/env", () => ({ env: { get autopilot() { return h.on; } } }));
vi.mock("@/lib/supabase/server", () => ({ requireUser: async () => ({ supabase: {}, user: { id: "u1" } }) }));
vi.mock("@/lib/autopilot/server", () => ({
  getVault: async () => ({ core: {}, extra: h.extra, completed: h.completed }),
  buildPack: async () => ({ items: h.items, answers: h.answers }),
}));
// Update chains are awaitable at any depth, so single-.eq and double-.eq filters both work.
const chain = (t: string): { eq: () => unknown; then: (r: (v: { error: unknown }) => unknown) => unknown } =>
  ({ eq: () => chain(t), then: (r) => r({ error: h.failTable === t ? { message: "boom" } : null }) });
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  from: (t: string) => ({
    select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: h.fields === null ? null : { answers: h.answers, form: { url: "https://job-boards.greenhouse.io/monzo/jobs/8232726", fields: h.fields } } }) }) }) }),
    update: (row: unknown) => { h.updates.push({ t, row }); return chain(t); },
    upsert: async (row: unknown) => { h.updates.push({ t, row }); return { error: null }; },
  }),
}) }));
import { openAndFill, setAnswer, preparePack } from "@/app/(app)/jobs/[id]/autopilot-actions";

const field = (key: string, label: string, over: Partial<F> = {}): F => ({ key, target: key, label, type: "select", required: true, options: [{ label: "Yes", value: "1" }, { label: "No", value: "0" }], ...over });
const JOB = "00000000-0000-4000-8000-000000000001";
const packRow = () => (h.updates.find((u) => (u as { t: string }).t === "autopilot_packs") as { row: { answers: Record<string, { value: unknown; approved?: boolean }> } }).row;
const vaultRow = () => h.updates.find((u) => (u as { t: string }).t === "autopilot_vault") as { row: { extra: Record<string, string> } } | undefined;

describe("autopilot actions", () => {
  beforeEach(() => {
    h.updates.length = 0; h.answers = {}; h.extra = {}; h.completed = true; h.on = true; h.failTable = null;
    h.fields = [field("q1", "Level of German?"), field("g", "What is your gender?"), field("d1", "Why us?", { type: "textarea", options: [] })];
  });
  it("is locked until setup is complete", async () => {
    h.completed = false;
    expect(await preparePack(JOB)).toEqual({ locked: true });
  });
  it("refuses everything while the feature is off", async () => {
    h.on = false;
    expect(await preparePack(JOB)).toMatchObject({ error: expect.any(String) });
    expect(await setAnswer(JOB, "q1", "1")).toEqual({ ok: false });
    expect(await openAndFill(JOB)).toHaveProperty("error");
    expect(h.updates).toEqual([]);
  });
  it("refuses openAndFill and setAnswer while the vault is incomplete", async () => {
    h.completed = false;
    expect(await openAndFill(JOB)).toEqual({ error: "Finish Autopilot setup first." });
    expect(await setAnswer(JOB, "q1", "1")).toEqual({ ok: false });
    expect(h.updates).toEqual([]);
  });
  it("refuses to open while ask/confirm items are unanswered", async () => {
    h.items = [{ field: field("q1", "Level of German?"), group: "ask", value: null, sourceLabel: null }];
    expect(await openAndFill(JOB)).toEqual({ error: expect.stringMatching(/answer/i) });
  });
  it("mints a hash-link once everything is answered, and a re-mint overwrites the hash", async () => {
    h.items = [{ field: field("q1", "Level of German?"), group: "ask", value: null, sourceLabel: null }];
    h.answers = { q1: { value: "1" } };
    const r = await openAndFill(JOB);
    expect(r).toMatchObject({ url: expect.stringMatching(/^https:\/\/job-boards\.greenhouse\.io\/monzo\/jobs\/8232726#placed=[A-Za-z0-9_-]{43}$/) });
    const row = packRow() as unknown as Record<string, unknown>;
    expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.token_used_at).toBeNull();
    expect(row.status).toBe("ready");
    expect(JSON.stringify(row)).not.toContain((r as { url: string }).url.split("#placed=")[1]); // only the hash is stored
    const r2 = await openAndFill(JOB);
    const rows = h.updates.map((u) => (u as { row: { token_hash: string } }).row.token_hash);
    expect(rows).toHaveLength(2);
    expect(rows[0]).not.toBe(rows[1]);
    expect((r2 as { url: string }).url).not.toBe((r as { url: string }).url);
  });
  it("never returns a url when the token write failed", async () => {
    h.items = [];
    h.failTable = "autopilot_packs";
    expect(await openAndFill(JOB)).toEqual({ error: "Couldn't create your link, please try again." });
  });
  it("returns ok:false when the pack write fails", async () => {
    h.failTable = "autopilot_packs";
    expect(await setAnswer(JOB, "q1", "1")).toEqual({ ok: false });
  });
  it("remembers an ask-once option LABEL from the stored form, keyed by the stored label", async () => {
    expect(await setAnswer(JOB, "q1", "1", { remember: true })).toEqual({ ok: true });
    expect(vaultRow()!.row.extra).toEqual({ "level of german": "Yes" });
  });
  it("never stores or remembers an answer for EEO, judged by the stored label, whatever the client says", async () => {
    expect(await setAnswer(JOB, "g", "1", { remember: true, rememberLabel: "Favourite colour?" } as never)).toEqual({ ok: false });
    expect(h.updates).toEqual([]);
  });
  it("rejects answers for consent, 'yours' and file fields", async () => {
    h.fields = [
      field("c", "I have read the Candidate Data Privacy Notice"), field("y", "Do you require any reasonable adjustments?", { type: "textarea", options: [] }),
      field("f", "Upload your academic transcript", { type: "file", options: [] }), field("cv", "Resume/CV", { type: "file", options: [] }),
    ];
    for (const k of ["c", "y", "f", "cv"]) expect(await setAnswer(JOB, k, "x")).toEqual({ ok: false });
    expect(h.updates).toEqual([]);
  });
  it("does not remember a value that is not one of the stored options", async () => {
    await setAnswer(JOB, "q1", "not-an-option", { remember: true });
    expect(vaultRow()).toBeUndefined();
  });
  it("rejects an unknown field key and an unknown pack", async () => {
    expect(await setAnswer(JOB, "nope", "x")).toEqual({ ok: false });
    h.fields = null as never;
    expect(await setAnswer(JOB, "q1", "1")).toEqual({ ok: false });
    expect(h.updates).toEqual([]);
  });
  it("rejects oversize values", async () => {
    expect(await setAnswer(JOB, "d1", "x".repeat(5001))).toEqual({ ok: false });
    expect(await setAnswer(JOB, "d1", Array(51).fill("a"))).toEqual({ ok: false });
    expect(await setAnswer(JOB, "d1", ["a".repeat(501)])).toEqual({ ok: false });
    expect(h.updates).toEqual([]);
  });
  it("stops remembering at 200 saved answers", async () => {
    h.extra = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`k${i}`, "v"]));
    await setAnswer(JOB, "q1", "1", { remember: true });
    expect(vaultRow()).toBeUndefined();
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

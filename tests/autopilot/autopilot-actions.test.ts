import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
type F = { key: string; target: string; label: string; type: string; required: boolean; options: { label: string; value: string }[] };
const h = vi.hoisted(() => ({
  items: [] as unknown[], answers: {} as Record<string, unknown>, extra: {} as Record<string, string | string[]>,
  completed: true, on: true, fields: [] as unknown[] | null,
}));
vi.mock("@/lib/env", () => ({ env: { get autopilot() { return h.on; } } }));
vi.mock("@/lib/autopilot/server", () => ({
  getVault: async () => ({ core: {}, extra: h.extra, completed: h.completed }),
  buildPack: async () => ({ items: h.items, answers: h.answers }),
}));
import { openAndFill, setAnswer, preparePack } from "@/app/(app)/jobs/[id]/autopilot-actions";
import { openVault, sealVault } from "@/lib/autopilot/vault-crypto";
import { db } from "@/lib/db/client";
import { autopilotPacks, autopilotVault } from "@/lib/db/schema";
import { LOCAL_USER_ID as UID } from "@/lib/auth/local-user";
import { seedJob, withTempDb } from "../cv/temp-db";

withTempDb();

const field = (key: string, label: string, over: Partial<F> = {}): F => ({ key, target: key, label, type: "select", required: true, options: [{ label: "Yes", value: "1" }, { label: "No", value: "0" }], ...over });
let JOB = "";
const FORM_URL = "https://job-boards.greenhouse.io/monzo/jobs/8232726";
const SEALED_EMPTY = () => sealVault("extra", UID, {});
type PackRow = typeof autopilotPacks.$inferSelect;
const packRow = () => db.select().from(autopilotPacks).where(eq(autopilotPacks.job_id, JOB)).get() as (PackRow & { answers: Record<string, { value: unknown; approved?: boolean }> }) | undefined;
const savedExtra = () => openVault("extra", UID, db.select().from(autopilotVault).where(eq(autopilotVault.user_id, UID)).get()?.extra);
/** Writes the test's pack fields/answers into the DB (the real table setAnswer/openAndFill read). */
function writePack() {
  db.delete(autopilotPacks).run();
  if (h.fields !== null) db.insert(autopilotPacks).values({ user_id: UID, job_id: JOB, form: { ats: "greenhouse", url: FORM_URL, fields: h.fields }, answers: h.answers as never }).run();
}
const failWrites = (table: string) => db.$client.exec(`CREATE TEMP TRIGGER fail_${table} BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT, 'boom'); END;`);
const vaultUnchanged = () => expect(savedExtra()).toEqual({});
/** Snapshot of everything the actions may write. */
const snapshot = () => JSON.stringify([db.select().from(autopilotPacks).all(), savedExtra()]);

describe("autopilot actions", () => {
  beforeEach(() => {
    JOB ||= seedJob().id;
    h.answers = {}; h.extra = {}; h.completed = true; h.on = true;
    h.fields = [field("q1", "Level of German?"), field("g", "What is your gender?"), field("d1", "Why us?", { type: "textarea", options: [] })];
    db.delete(autopilotVault).run();
    db.insert(autopilotVault).values({ user_id: UID, core: {}, extra: SEALED_EMPTY() }).run();
    writePack();
  });
  afterEach(() => { for (const t of ["autopilot_packs", "autopilot_vault"]) db.$client.exec(`DROP TRIGGER IF EXISTS temp.fail_${t}`); });
  it("is locked until setup is complete", async () => {
    h.completed = false;
    expect(await preparePack(JOB)).toEqual({ locked: true });
  });
  it("refuses everything while the feature is off", async () => {
    h.on = false;
    const before = snapshot();
    expect(await preparePack(JOB)).toMatchObject({ error: expect.any(String) });
    expect(await setAnswer(JOB, "q1", "1")).toEqual({ ok: false });
    expect(await openAndFill(JOB)).toHaveProperty("error");
    expect(snapshot()).toBe(before);
  });
  it("refuses openAndFill and setAnswer while the vault is incomplete", async () => {
    h.completed = false;
    const before = snapshot();
    expect(await openAndFill(JOB)).toEqual({ error: "Finish Autopilot setup first." });
    expect(await setAnswer(JOB, "q1", "1")).toEqual({ ok: false });
    expect(snapshot()).toBe(before);
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
    const row = packRow()!;
    expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.token_used_at).toBeNull();
    expect(row.status).toBe("ready");
    expect(JSON.stringify(row)).not.toContain((r as { url: string }).url.split("#placed=")[1]); // only the hash is stored
    const r2 = await openAndFill(JOB);
    expect(packRow()!.token_hash).not.toBe(row.token_hash);
    expect((r2 as { url: string }).url).not.toBe((r as { url: string }).url);
  });
  it("never returns a url when the token write failed", async () => {
    h.items = [];
    failWrites("autopilot_packs");
    expect(await openAndFill(JOB)).toEqual({ error: "Couldn't create your link, please try again." });
  });
  it("returns ok:false when the pack write fails", async () => {
    failWrites("autopilot_packs");
    expect(await setAnswer(JOB, "q1", "1")).toEqual({ ok: false });
  });
  it("returns ok:false when the vault write fails", async () => {
    failWrites("autopilot_vault");
    expect(await setAnswer(JOB, "q1", "1")).toEqual({ ok: false });
  });
  it("remembers an ask-once option LABEL from the stored form, keyed by the stored label", async () => {
    expect(await setAnswer(JOB, "q1", "1", { remember: true })).toEqual({ ok: true });
    expect(savedExtra()).toEqual({ "level of german": "Yes" });
  });
  it("never stores or remembers an answer for EEO, judged by the stored label, whatever the client says", async () => {
    const before = snapshot();
    expect(await setAnswer(JOB, "g", "1", { remember: true, rememberLabel: "Favourite colour?" } as never)).toEqual({ ok: false });
    expect(snapshot()).toBe(before);
  });
  it("rejects answers for consent, 'yours' and file fields", async () => {
    h.fields = [
      field("c", "I have read the Candidate Data Privacy Notice"), field("y", "Do you require any reasonable adjustments?", { type: "textarea", options: [] }),
      field("f", "Upload your academic transcript", { type: "file", options: [] }), field("cv", "Resume/CV", { type: "file", options: [] }),
    ];
    writePack();
    const before = snapshot();
    for (const k of ["c", "y", "f", "cv"]) expect(await setAnswer(JOB, k, "x")).toEqual({ ok: false });
    expect(snapshot()).toBe(before);
  });
  it("does not remember a value that is not one of the stored options", async () => {
    await setAnswer(JOB, "q1", "not-an-option", { remember: true });
    vaultUnchanged();
  });
  it("rejects an unknown field key and an unknown pack", async () => {
    const before = snapshot();
    expect(await setAnswer(JOB, "nope", "x")).toEqual({ ok: false });
    h.fields = null;
    writePack();
    expect(await setAnswer(JOB, "q1", "1")).toEqual({ ok: false });
    expect(packRow()).toBeUndefined();
    expect(JSON.parse(snapshot())[1]).toEqual(JSON.parse(before)[1]);
  });
  it("rejects oversize values", async () => {
    const before = snapshot();
    expect(await setAnswer(JOB, "d1", "x".repeat(5001))).toEqual({ ok: false });
    expect(await setAnswer(JOB, "d1", Array(51).fill("a"))).toEqual({ ok: false });
    expect(await setAnswer(JOB, "d1", ["a".repeat(501)])).toEqual({ ok: false });
    expect(snapshot()).toBe(before);
  });
  it("remembers by default (confirm rows too), multiselect labels as a list, and skips rewriting an unchanged answer", async () => {
    h.fields = [field("q1", "Level of German?"), field("m", "Which offices?", { type: "multiselect", options: [{ label: "London", value: "L" }, { label: "Dublin", value: "D" }] })];
    writePack();
    await setAnswer(JOB, "q1", "0");
    expect(savedExtra()).toEqual({ "level of german": "No" });
    h.extra = savedExtra() as typeof h.extra;
    await setAnswer(JOB, "m", ["L", "D"]);
    expect(savedExtra()).toEqual({ "level of german": "No", "which offices": ["London", "Dublin"] });
    db.update(autopilotVault).set({ extra: SEALED_EMPTY() }).run();
    h.extra = { "level of german": "No" };
    await setAnswer(JOB, "q1", "0");
    vaultUnchanged();
    await setAnswer(JOB, "q1", "1", { remember: false });
    vaultUnchanged();
  });
  it("never remembers free-text answers", async () => {
    await setAnswer(JOB, "d1", "my essay", { approved: true });
    vaultUnchanged();
  });
  it("stops remembering at 200 saved answers", async () => {
    h.extra = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`k${i}`, "v"]));
    await setAnswer(JOB, "q1", "1", { remember: true });
    vaultUnchanged();
  });
  it("merges into existing answers and keeps drafts unapproved unless approved:true", async () => {
    h.answers = { other: { value: "keep", approved: true } };
    writePack();
    await setAnswer(JOB, "d1", "my text");
    expect(packRow()!.answers).toEqual({ other: { value: "keep", approved: true }, d1: { value: "my text", approved: false } });
    expect(packRow()!.status).toBe("draft");
    await setAnswer(JOB, "d1", "my text", { approved: true });
    expect(packRow()!.answers.d1).toEqual({ value: "my text", approved: true });
  });
  it("rejects an unknown job id", async () => {
    expect(await setAnswer("nope", "q1", "x")).toEqual({ ok: false });
    expect(await openAndFill("nope")).toEqual({ error: "Unknown job" });
  });
});

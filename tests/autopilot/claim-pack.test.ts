import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { hashToken } from "@/lib/autopilot/handoff";
import { claimPack } from "@/lib/autopilot/server";
import { sealVault } from "@/lib/autopilot/vault-crypto";
import { db } from "@/lib/db/client";
import { applications, autopilotPacks, autopilotVault, cvs } from "@/lib/db/schema";
import { LOCAL_USER_ID as UID } from "@/lib/auth/local-user";
import { seedCv, seedJob, useTempDb } from "../cv/temp-db";

useTempDb();

const TOKEN = "a".repeat(43);
const form = { ats: "greenhouse", url: "https://x/apply", fields: [
  { key: "first_name", label: "First name", type: "text", required: true, options: [], target: "#first_name" },
] };
let jobId: string;

function reset(pack: Partial<typeof autopilotPacks.$inferInsert> = {}, paths: { tailored?: string | null; cv?: string } = {}) {
  db.delete(autopilotPacks).run();
  db.delete(applications).run();
  db.delete(cvs).run();
  db.delete(autopilotVault).run();
  jobId = seedJob().id;
  db.insert(autopilotVault).values({
    user_id: UID, core: sealVault("core", UID, { first_name: "Ayşe", last_name: "Yılmaz", secret_key: "SHOULD-NOT-LEAK" }), extra: sealVault("extra", UID, {}),
    completed_at: "x",
  }).run();
  db.insert(autopilotPacks).values({
    user_id: UID, job_id: jobId, form, answers: {}, status: "ready", token_hash: hashToken(TOKEN),
    token_expires_at: new Date(Date.now() + 60_000).toISOString(), ...pack,
  }).run();
  const tailored = paths.tailored === undefined ? `${UID}/${jobId}.pdf` : paths.tailored;
  if (tailored) db.insert(applications).values({ user_id: UID, job_id: jobId, tailored_cv_path: tailored }).run();
  seedCv({ storage_path: paths.cv ?? `${UID}/cv.pdf`, is_active: true });
}
const packRow = () => db.select().from(autopilotPacks).where(eq(autopilotPacks.job_id, jobId)).get()!;

describe("claimPack", () => {
  beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => {}); });
  it("404 for an unknown hash", async () => {
    reset({ token_hash: hashToken("b".repeat(43)) });
    expect(await claimPack(TOKEN)).toEqual({ status: 404 });
  });
  it("410 when already used or expired, and the pack is untouched", async () => {
    reset({ token_used_at: "2026-10-16T00:00:00Z" });
    expect(await claimPack(TOKEN)).toEqual({ status: 410 });
    reset({ token_expires_at: new Date(Date.now() - 1000).toISOString() });
    expect(await claimPack(TOKEN)).toEqual({ status: 410 });
    expect(packRow()).toMatchObject({ status: "ready", token_used_at: null });
  });
  it("is single use: a second claim of the same token is 410", async () => {
    reset();
    expect((await claimPack(TOKEN)).status).toBe(200);
    expect(packRow()).toMatchObject({ status: "claimed" });
    expect(packRow().token_used_at).toBeTruthy();
    expect(await claimPack(TOKEN)).toEqual({ status: 410 });
  });
  it("cv is null when the storage path is not under the user's prefix", async () => {
    reset({}, { tailored: "other-user/x.pdf", cv: "other-user/y.pdf" });
    const r = await claimPack(TOKEN);
    expect(r.status === 200 && r.body.cv).toBeNull();
  });
  it("falls back to the active CV when there is no tailored one", async () => {
    reset({}, { tailored: null });
    const r = await claimPack(TOKEN);
    expect(r.status === 200 && r.body.cv?.url).toBe(`/api/files/cvs/${UID}/cv.pdf`);
  });
  it("happy path returns only this form's fill plan and a same-origin tailored CV path", async () => {
    reset();
    const r = await claimPack(TOKEN);
    expect(r.status).toBe(200);
    if (r.status !== 200) return;
    expect(Object.keys(r.body).sort()).toEqual(["ats", "cv", "fields", "url"]);
    expect(r.body.fields).toHaveLength(1);
    expect(r.body.fields[0]).toMatchObject({ target: "#first_name", value: "Ayşe" });
    expect(r.body.cv).toEqual({ url: `/api/files/tailored/${UID}/${jobId}.pdf`, filename: "Ayşe-Yılmaz-CV.pdf" });
    expect(JSON.stringify(r.body)).not.toContain("SHOULD-NOT-LEAK");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(TOKEN);
  });
});

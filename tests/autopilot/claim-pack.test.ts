import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { hashToken } from "@/lib/autopilot/handoff";
import { claimPack } from "@/lib/autopilot/server";
import { letterFilename } from "@/lib/cover-letter/pdf";
import { sealVault } from "@/lib/autopilot/vault-crypto";
import { db } from "@/lib/db/client";
import { applications, autopilotPacks, autopilotVault, coverLetterOutputs, coverLetters, cvs } from "@/lib/db/schema";
import { LOCAL_USER_ID as UID } from "@/lib/auth/local-user";
import { seedCv, seedJob, withTempDb } from "../cv/temp-db";

withTempDb();

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

const FORM_COVER = { ats: "greenhouse", url: "https://x/apply", fields: [
  { key: "cover_letter", label: "Cover Letter", type: "file", required: false, options: [], target: "#cover_letter" },
  { key: "why_us", label: "Why do you want to join us?", type: "textarea", required: true, options: [], target: "#why_us" },
] };
function seedOutputs(rows: { target: { kind: "upload" } | { kind: "field"; fieldKey: string; label: string }; status: "draft" | "ready"; text?: string; pdf_path?: string | null }[]) {
  const letter = db.insert(coverLetters).values({ user_id: UID, job_id: jobId }).returning().get();
  for (const r of rows) db.insert(coverLetterOutputs).values({ letter_id: letter.id, mode: "full_letter", text: "", pdf_path: null, ...r }).run();
}

describe("claimPack cover letters", () => {
  beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => {}); });
  const plan = async () => { const r = await claimPack(TOKEN); if (r.status !== 200) throw new Error("claim failed"); return r.body; };
  it("cover is null and cover fields stay yours when no letter exists (and none is created)", async () => {
    reset({ form: FORM_COVER });
    const b = await plan();
    expect(b.cover).toBeNull();
    expect(b.fields.map((f) => f.mode)).toEqual(["yours", "yours"]);
    expect(db.select().from(coverLetters).all()).toHaveLength(0);
  });
  it("a Ready upload output returns the letter PDF and a cover file instruction", async () => {
    reset({ form: FORM_COVER });
    seedOutputs([{ target: { kind: "upload" }, status: "ready", pdf_path: `${UID}/l1-o1.pdf` }]);
    const b = await plan();
    // The same name the card's Download PDF uses: First-Last_Cover-Letter_Company_YYYY-MM.pdf.
    expect(b.cover).toEqual({ url: `/api/files/letters/${UID}/l1-o1.pdf`, filename: letterFilename("Ayşe", "Yılmaz", "Acme", new Date()) });
    expect(b.fields[0]).toMatchObject({ mode: "fill", asset: "cover" });
    expect(b.fields[1].mode).toBe("yours");
  });
  it("a Ready field output pastes its text into the matching textarea", async () => {
    reset({ form: FORM_COVER });
    seedOutputs([{ target: { kind: "field", fieldKey: "why_us", label: "Why us" }, status: "ready", text: "Because of the desk." }]);
    const b = await plan();
    expect(b.fields[1]).toMatchObject({ mode: "fill", value: "Because of the desk.", sourceLabel: "your cover letter" });
    expect(b.cover).toBeNull();
  });
  it("draft outputs are never filled", async () => {
    reset({ form: FORM_COVER });
    seedOutputs([
      { target: { kind: "upload" }, status: "draft", pdf_path: `${UID}/l1-o1.pdf` },
      { target: { kind: "field", fieldKey: "why_us", label: "Why us" }, status: "draft", text: "Draft text" },
    ]);
    const b = await plan();
    expect(b.cover).toBeNull();
    expect(b.fields.map((f) => f.mode)).toEqual(["yours", "yours"]);
  });
  it("a Ready upload whose pdf_path is outside the user's prefix, or missing, gives no cover file", async () => {
    reset({ form: FORM_COVER });
    seedOutputs([{ target: { kind: "upload" }, status: "ready", pdf_path: "other-user/x.pdf" }]);
    const b = await plan();
    expect(b.cover).toBeNull();
    expect(b.fields[0].mode).toBe("yours");
    reset({ form: FORM_COVER });
    seedOutputs([{ target: { kind: "upload" }, status: "ready", pdf_path: null }]);
    expect((await plan()).cover).toBeNull();
  });
});

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
    expect(Object.keys(r.body).sort()).toEqual(["ats", "cover", "cv", "fields", "url"]);
    expect(r.body.fields).toHaveLength(1);
    expect(r.body.fields[0]).toMatchObject({ target: "#first_name", value: "Ayşe" });
    expect(r.body.cv).toEqual({ url: `/api/files/tailored/${UID}/${jobId}.pdf`, filename: "Ayşe-Yılmaz-CV.pdf" });
    expect(JSON.stringify(r.body)).not.toContain("SHOULD-NOT-LEAK");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(TOKEN);
  });
});

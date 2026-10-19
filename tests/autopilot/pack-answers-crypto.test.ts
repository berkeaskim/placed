import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ env: { autopilot: true } }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/autopilot/suggest", () => ({ suggestAnswers: vi.fn(async () => ({})) }));
import { setAnswer } from "@/app/(app)/jobs/[id]/autopilot-actions";
import { buildPack, claimPack } from "@/lib/autopilot/server";
import { hashToken } from "@/lib/autopilot/handoff";
import { openAnswers, sealAnswers, sealVault } from "@/lib/autopilot/vault-crypto";
import { db } from "@/lib/db/client";
import { autopilotPacks, autopilotVault } from "@/lib/db/schema";
import { LOCAL_USER_ID as UID } from "@/lib/auth/local-user";
import { AYSE_CORE } from "./fixtures";
import { seedJob, withTempDb } from "../cv/temp-db";

withTempDb();

const TOKEN = "b".repeat(43);
const fields = [
  { key: "q_gender", target: "#q_gender", label: "How would you describe your gender identity?", type: "select", required: false, options: [{ label: "Woman", value: "opt_woman_7f3e9c" }, { label: "Prefer not to say", value: "p2" }] },
  { key: "q_licence", target: "#q_licence", label: "Do you hold a full UK driving licence?", type: "text", required: true, options: [] },
];
const form = { ats: "greenhouse", url: "https://x/apply", fields };
let jobId = "";
const raw = () => db.select().from(autopilotPacks).where(eq(autopilotPacks.job_id, jobId)).get()!;

describe("pack answers at rest", () => {
  beforeEach(() => {
    db.delete(autopilotPacks).run();
    db.delete(autopilotVault).run();
    db.insert(autopilotVault).values({ user_id: UID, core: sealVault("core", UID, { ...AYSE_CORE }), extra: sealVault("extra", UID, {}), completed_at: new Date().toISOString() }).run();
    jobId = seedJob().id;
    db.insert(autopilotPacks).values({ user_id: UID, job_id: jobId, form, answers: {}, suggestions: {} }).run();
  });

  it("an EEO answer is sealed in the pack row, yet the claimed fill plan still fills it", async () => {
    expect((await setAnswer(jobId, "q_gender", "opt_woman_7f3e9c", { remember: false })).ok).toBe(true);
    expect((await setAnswer(jobId, "q_licence", "Yes", { remember: false })).ok).toBe(true);
    const stored = JSON.stringify(raw().answers);
    expect(stored).not.toContain("opt_woman_7f3e9c");
    expect(stored).toContain("Yes"); // only EEO answers are sealed
    expect((await buildPack(UID, jobId)).answers.q_gender).toEqual({ value: "opt_woman_7f3e9c", approved: false });
    expect(JSON.stringify(raw().answers)).not.toContain("opt_woman_7f3e9c"); // a rebuild writes the sealed value back, not the opened one
    db.update(autopilotPacks).set({ token_hash: hashToken(TOKEN), token_expires_at: new Date(Date.now() + 60_000).toISOString() }).where(eq(autopilotPacks.job_id, jobId)).run();
    const claim = await claimPack(TOKEN);
    expect(claim.status).toBe(200);
    const plan = claim.status === 200 ? claim.body.fields : [];
    expect(plan.find((f) => f.target === "#q_gender")).toMatchObject({ mode: "fill", value: "opt_woman_7f3e9c", optionLabel: "Woman" });
  });

  it("a sealed answer moved onto another field or job does not open", () => {
    const sealed = sealAnswers(UID, jobId, fields as never, { q_gender: { value: ["opt_woman_7f3e9c"], approved: false } });
    expect(openAnswers(UID, jobId, sealed)).toEqual({ q_gender: { value: ["opt_woman_7f3e9c"], approved: false } });
    expect(openAnswers(UID, "other-job", sealed)).toEqual({});
    expect(openAnswers(UID, jobId, { q_other: sealed.q_gender })).toEqual({});
    expect(openAnswers(UID, jobId, { q_gender: { value: "legacy", approved: false } })).toEqual({ q_gender: { value: "legacy", approved: false } });
  });
});

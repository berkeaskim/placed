import { beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { autopilotPacks } from "@/lib/db/schema";
import { LOCAL_USER_ID } from "@/lib/auth/local-user";
import { seedCv, seedJob, withTempDb } from "../cv/temp-db";
import type { DraftResult } from "@/lib/autopilot/drafts";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/autopilot/suggest", () => ({ suggestAnswers: vi.fn() }));
vi.mock("@/lib/autopilot/drafts", async (o) => ({ ...(await o<typeof import("@/lib/autopilot/drafts")>()), draftAnswer: vi.fn() }));

import { suggestAnswers } from "@/lib/autopilot/suggest";
import { draftAnswer } from "@/lib/autopilot/drafts";
import { buildPack, generateDraft } from "@/lib/autopilot/server";

withTempDb();

const form = {
  ats: "greenhouse", url: "https://job-boards.greenhouse.io/acme/jobs/1",
  fields: [
    { key: "q_licence", label: "Do you hold a full UK driving licence?", type: "text", required: true, options: [], target: "q_licence" },
    { key: "q_free", label: "Tell us about a project you are proud of", type: "textarea", required: false, options: [], wordLimit: 150, target: "q_free" },
  ],
};
const result = (over: Partial<DraftResult> = {}): DraftResult => ({ text: "Built a thing.", sentences: [], caught: [], words: 3, limit: 150, thin: false, source: "ai", ...over });

let cvSeeded = false;
function seedPack() {
  if (!cvSeeded) { seedCv({ parsed_json: { experience: [] } as never }); cvSeeded = true; }
  const job = seedJob();
  db.insert(autopilotPacks).values({ user_id: LOCAL_USER_ID, job_id: job.id, form, answers: {} }).run();
  return job.id;
}
const row = (jobId: string) => db.select().from(autopilotPacks).where(and(eq(autopilotPacks.user_id, LOCAL_USER_ID), eq(autopilotPacks.job_id, jobId))).get()!;

beforeEach(() => { vi.mocked(suggestAnswers).mockReset(); vi.mocked(draftAnswer).mockReset(); });

describe("pack cache", () => {
  it("EEO items are never sent to suggestAnswers", async () => {
    const jobId = seedPack();
    db.update(autopilotPacks).set({ form: { ...form, fields: [...form.fields, { key: "q_gender", label: "How would you describe your gender identity?", type: "select", required: false, options: [{ label: "Woman", value: "1" }, { label: "Prefer not to say", value: "2" }], target: "q_gender" }] } }).where(eq(autopilotPacks.job_id, jobId)).run();
    vi.mocked(suggestAnswers).mockResolvedValue({});
    const built = await buildPack(LOCAL_USER_ID, jobId);
    expect(built.items.find((i) => i.field.key === "q_gender")!.group).toBe("ask");
    const sent = vi.mocked(suggestAnswers).mock.calls[0][0].items.map((i) => i.field.key);
    expect(sent).toEqual(["q_licence"]);
  });

  it("buildPack reuses stored suggestions", async () => {
    const jobId = seedPack();
    vi.mocked(suggestAnswers).mockResolvedValue({ q_licence: "Yes" });
    await buildPack(LOCAL_USER_ID, jobId);
    const second = await buildPack(LOCAL_USER_ID, jobId);
    expect(suggestAnswers).toHaveBeenCalledTimes(1);
    const item = second.items.find((i) => i.field.key === "q_licence")!;
    expect(item.group).toBe("confirm");
    expect(item.sourceLabel).toBe("suggested from your CV");
  });

  it("buildPack stores an empty computed result so it is not re-run", async () => {
    const jobId = seedPack();
    vi.mocked(suggestAnswers).mockResolvedValue({});
    await buildPack(LOCAL_USER_ID, jobId);
    await buildPack(LOCAL_USER_ID, jobId);
    expect(suggestAnswers).toHaveBeenCalledTimes(1);
    expect(row(jobId).suggestions).toEqual({});
  });

  it("buildPack never drafts", async () => {
    const jobId = seedPack();
    vi.mocked(suggestAnswers).mockResolvedValue({});
    const { items } = await buildPack(LOCAL_USER_ID, jobId);
    expect(draftAnswer).not.toHaveBeenCalled();
    expect(items.find((i) => i.field.key === "q_free")!.draft).toBeUndefined();
  });

  it("generateDraft stores and reuses", async () => {
    const jobId = seedPack();
    const r = result();
    vi.mocked(draftAnswer).mockResolvedValue(r);
    expect(await generateDraft(LOCAL_USER_ID, jobId, "q_free")).toEqual(r);
    expect(row(jobId).drafts.q_free).toEqual(r);
    expect(await generateDraft(LOCAL_USER_ID, jobId, "q_free")).toEqual(r);
    expect(draftAnswer).toHaveBeenCalledTimes(1);
    vi.mocked(suggestAnswers).mockResolvedValue({});
    const { items } = await buildPack(LOCAL_USER_ID, jobId);
    expect(items.find((i) => i.field.key === "q_free")!.draft).toEqual(r);
  });

  it("generateDraft stores and returns the empty result on failure", async () => {
    const jobId = seedPack();
    const empty = result({ text: "", words: 0, thin: true, source: "none" });
    vi.mocked(draftAnswer).mockResolvedValue(empty);
    expect(await generateDraft(LOCAL_USER_ID, jobId, "q_free")).toEqual(empty);
    expect(row(jobId).drafts.q_free).toEqual(empty);
  });

  it("generateDraft returns null for a non-free-text field key", async () => {
    const jobId = seedPack();
    expect(await generateDraft(LOCAL_USER_ID, jobId, "q_licence")).toBeNull();
    expect(await generateDraft(LOCAL_USER_ID, jobId, "nope")).toBeNull();
    expect(draftAnswer).not.toHaveBeenCalled();
  });
});

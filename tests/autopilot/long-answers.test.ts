import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ env: { autopilot: true } }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/autopilot/suggest", () => ({ suggestAnswers: vi.fn(async () => ({})) }));
import { setAnswer } from "@/app/(app)/jobs/[id]/autopilot-actions";
import { forgetLongAnswer } from "@/app/(app)/autopilot/setup/actions";
import { buildPack, findPreviousAnswer, listLongAnswers } from "@/lib/autopilot/server";
import { sealVault } from "@/lib/autopilot/vault-crypto";
import { db } from "@/lib/db/client";
import { autopilotLongAnswers, autopilotPacks, autopilotVault } from "@/lib/db/schema";
import { LOCAL_USER_ID as UID } from "@/lib/auth/local-user";
import { AYSE_CORE } from "./fixtures";
import { seedJob, withTempDb } from "../cv/temp-db";

withTempDb();

const ESSAY = "I built a budgeting app used by 300 students at my university.";
const form = (label: string) => ({
  ats: "greenhouse", url: "https://job-boards.greenhouse.io/acme/jobs/1",
  fields: [{ key: "q_free", target: "q_free", label, type: "textarea", required: false, options: [], wordLimit: 150 }],
});
function jobWithPack(company: string, label = "Describe a project you are proud of") {
  const job = seedJob({}, { name: company });
  db.insert(autopilotPacks).values({ user_id: UID, job_id: job.id, form: form(label), answers: {}, suggestions: {} }).run();
  return job.id;
}
const rows = () => db.select().from(autopilotLongAnswers).all();

describe("long answers", () => {
  beforeEach(() => {
    db.delete(autopilotLongAnswers).run();
    db.delete(autopilotPacks).run();
    db.delete(autopilotVault).run();
    db.insert(autopilotVault).values({ user_id: UID, core: sealVault("core", UID, { ...AYSE_CORE }), extra: sealVault("extra", UID, {}), completed_at: new Date().toISOString() }).run();
  });

  it("an approved long answer is stored per job and encrypted at rest", async () => {
    const job = jobWithPack("Monzo");
    expect(await setAnswer(job, "q_free", ESSAY, { approved: true })).toEqual({ ok: true });
    const all = rows();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ user_id: UID, job_id: job, field_label: "Describe a project you are proud of", company: "Monzo" });
    const raw = db.$client.prepare("select text from autopilot_long_answers").get() as { text: string };
    expect(raw.text).not.toContain("budgeting");
    expect(listLongAnswers(UID)).toEqual([{ id: all[0].id, label: "Describe a project you are proud of", company: "Monzo", preview: ESSAY }]);
    // Re-approving an edit replaces the job's row rather than adding one.
    await setAnswer(job, "q_free", "A shorter version.", { approved: true });
    expect(rows()).toHaveLength(1);
    expect(listLongAnswers(UID)[0].preview).toBe("A shorter version.");
  });

  it("an unapproved save stores nothing", async () => {
    const job = jobWithPack("Monzo");
    await setAnswer(job, "q_free", ESSAY);
    await setAnswer(job, "q_free", "   ", { approved: true });
    expect(rows()).toHaveLength(0);
    await setAnswer(job, "q_free", ESSAY, { approved: true });
    await setAnswer(job, "q_free", "", { approved: false });
    expect(rows()).toHaveLength(1);
  });

  it("findPreviousAnswer matches a similar label on another job and ignores the same job", async () => {
    const first = jobWithPack("Monzo");
    await setAnswer(first, "q_free", ESSAY, { approved: true });
    const second = jobWithPack("Wise");
    expect(findPreviousAnswer(UID, first, "Describe a project you are proud of")).toBeNull();
    expect(findPreviousAnswer(UID, second, "Describe a project you are proud of.")).toEqual({ text: ESSAY, company: "Monzo", staleNote: null });
    expect(findPreviousAnswer(UID, second, "Please describe a project that you are proud of")).toEqual({ text: ESSAY, company: "Monzo", staleNote: null });
    expect(findPreviousAnswer(UID, second, "Why do you want to work here?")).toBeNull();
    expect(findPreviousAnswer("someone-else", second, "Describe a project you are proud of")).toBeNull();
  });

  it("buildPack attaches previous to the matching draft item", async () => {
    const first = jobWithPack("Monzo");
    await setAnswer(first, "q_free", ESSAY, { approved: true });
    const second = jobWithPack("Wise", "Tell us: describe a project you are proud of");
    const { items } = await buildPack(UID, second);
    expect(items[0]).toMatchObject({ group: "draft", previous: { text: ESSAY, company: "Monzo", words: 12 } });
    const own = await buildPack(UID, first);
    expect(own.items[0].previous).toBeUndefined();
  });

  it("forgetLongAnswer removes only the user's row", async () => {
    const a = jobWithPack("Monzo");
    await setAnswer(a, "q_free", ESSAY, { approved: true });
    const mine = rows()[0];
    const b = seedJob({}, { name: "Wise" });
    db.insert(autopilotLongAnswers).values({ user_id: "someone-else", job_id: b.id, field_label: "x", company: "Wise", text: "sealed" }).run();
    const theirs = rows().find((r) => r.user_id === "someone-else")!;
    expect(await forgetLongAnswer(theirs.id)).toEqual({ ok: true });
    expect(rows()).toHaveLength(2);
    expect(await forgetLongAnswer(mine.id)).toEqual({ ok: true });
    expect(rows().map((r) => r.user_id)).toEqual(["someone-else"]);
    expect(db.select().from(autopilotLongAnswers).where(eq(autopilotLongAnswers.user_id, UID)).all()).toHaveLength(0);
  });
});

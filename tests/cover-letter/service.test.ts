import { existsSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db/client";
import { confirmedFacts, coverLetters, xpEvents } from "@/lib/db/schema";
import { resolveFile } from "@/lib/files";
import { buildDraftPrompt } from "@/lib/cover-letter/draft";
import { draftInputFor, openCard, researchSettled, type CardView } from "@/lib/cover-letter/service";
import { runGeneration } from "@/lib/cover-letter/generate";
import * as actions from "@/app/(app)/jobs/[id]/cover-letter-actions";
import { FIXTURE_ANSWERS, FIXTURE_FACTS } from "./fixtures";
import { seedNorthbridgeJob, seedStudent, U } from "./seed";

vi.stubEnv("AI_MODE", "fixture");
beforeAll(() => seedStudent());

const view = (r: CardView | { error: string }): CardView => {
  if ("error" in r) throw new Error(r.error);
  return r;
};

/** Answers the four fixture questions through the actions, in the order nextQuestion asks them. */
async function interview(jobId: string): Promise<CardView> {
  let v = view(await actions.openCoverLetter(jobId));
  await researchSettled();
  for (let k = 0; k < 6 && v.next; k++) {
    const q = v.next;
    if (q.id === "wait_research") { await researchSettled(); v = view(await actions.openCoverLetter(jobId)); continue; }
    v = q.id === "facts"
      ? view(await actions.pickFacts(jobId, [FIXTURE_FACTS[0].id]))
      : view(await actions.answerQuestion(jobId, q.id, FIXTURE_ANSWERS.find((a) => a.question === q.id)?.text ?? null));
  }
  return v;
}

async function drain(jobId: string, outputId: string) {
  const events: { event: string; data: unknown }[] = [];
  for await (const e of runGeneration(U, jobId, { outputId, kind: "draft" }, new AbortController().signal)) events.push(e);
  return events;
}

describe("openCard", () => {
  it("returns the same letter twice, with one upload output and the mode named in the chat", async () => {
    const jobId = seedNorthbridgeJob();
    const a = await openCard(U, jobId);
    const b = await openCard(U, jobId);
    await researchSettled();
    expect(b.letterId).toBe(a.letterId);
    expect(b.outputs).toHaveLength(1);
    expect(b.outputs[0]).toMatchObject({ target: { kind: "upload" }, mode: "full_letter", status: "draft" });
    expect(b.chat[0]).toMatchObject({ from: "bot" });
    expect(b.chat[0].text).toMatch(/full cover letter/i);
    expect(b.next).toMatchObject({ id: "why_firm" });
    expect(b).toMatchObject({ company: "Northbridge Capital", feedbackOnly: false, noLetter: false });
  });

  it("runs research in the background and saves its facts", async () => {
    const jobId = seedNorthbridgeJob();
    const first = await openCard(U, jobId);
    expect(first.researchState).toBe("running");
    await researchSettled();
    const v = await openCard(U, jobId);
    expect(v.researchState).toBe("done");
    expect(v.facts.map((f) => f.id)).toEqual(FIXTURE_FACTS.map((f) => f.id));
  });

  it("resumes interrupted draft as idle: a stale streaming letter opens as interrupted", async () => {
    const jobId = seedNorthbridgeJob();
    const { letterId } = await openCard(U, jobId);
    await researchSettled();
    const old = new Date(Date.now() - 3 * 60_000).toISOString();
    db.update(coverLetters).set({ draft_state: "streaming", updated_at: old }).where(eq(coverLetters.id, letterId)).run();
    expect((await openCard(U, jobId)).draftState).toBe("interrupted");
    // A fresh stream (under 2 minutes) is left alone.
    db.update(coverLetters).set({ draft_state: "streaming", updated_at: new Date().toISOString() }).where(eq(coverLetters.id, letterId)).run();
    expect((await openCard(U, jobId)).draftState).toBe("streaming");
  });

  it("is feedback-only under an AI policy and noLetter when the posting wants none", async () => {
    const ai = seedNorthbridgeJob(["Please do not use AI to write your application."]);
    const v = await openCard(U, ai);
    expect(v.feedbackOnly).toBe(true);
    expect(v.next).toBeNull();
    const none = seedNorthbridgeJob(["We ask that you do not send a cover letter."]);
    const w = await openCard(U, none);
    await researchSettled();
    expect(w.noLetter).toBe(true);
    expect(w.outputs[0].mode).toBe("skip");
  });
});

describe("the interview", () => {
  it("reaches next === null through the actions, remembering why_firm and the story", async () => {
    const jobId = seedNorthbridgeJob();
    const v = await interview(jobId);
    expect(v.next).toBeNull();
    expect(v.chat.filter((m) => m.from === "me")).toHaveLength(4);
    const saved = view(await actions.openCoverLetter(seedNorthbridgeJob()));
    await researchSettled();
    // A second Northbridge job: the story is offered again as a saved answer.
    expect(saved.savedStory?.text).toBe(FIXTURE_ANSWERS[2].text);
  });

  it("asks to confirm a named person and keeps the name out of the draft prompt until confirmed", async () => {
    const jobId = seedNorthbridgeJob();
    await actions.openCoverLetter(jobId);
    await researchSettled();
    const v = view(await actions.answerQuestion(jobId, "why_firm", "Sarah Khan told me how much risk summer analysts own at Northbridge."));
    expect(v.confirmPerson).toEqual({ name: "Sarah Khan" });
    const outputId = v.outputs[0].id;
    const masked = buildDraftPrompt(await draftInputFor(U, jobId, outputId)).prompt;
    expect(masked).not.toContain("Sarah Khan");
    expect(masked).toContain("a Northbridge Capital associate told me");
    const ok = view(await actions.confirmPersonAction(jobId, "Sarah Khan", true));
    expect(ok.confirmPerson).toBeNull();
    expect(buildDraftPrompt(await draftInputFor(U, jobId, outputId)).prompt).toContain("Sarah Khan told me");
  });

  it("gates every named person, in any answer kind, one confirmation at a time", async () => {
    const jobId = seedNorthbridgeJob();
    await actions.openCoverLetter(jobId);
    await researchSettled();
    let v = view(await actions.answerQuestion(jobId, "why_firm", "I met Sarah Khan and James Patel at the fair."));
    expect(v.confirmPerson).toEqual({ name: "Sarah Khan" });
    const outputId = v.outputs[0].id;
    const prompt = async () => buildDraftPrompt(await draftInputFor(U, jobId, outputId)).prompt;
    expect(await prompt()).not.toMatch(/Sarah|Khan|James|Patel/);
    v = view(await actions.confirmPersonAction(jobId, "Sarah Khan", true));
    expect(v.confirmPerson).toEqual({ name: "James Patel" });
    expect(await prompt()).toContain("Sarah Khan");
    expect(await prompt()).not.toMatch(/James|Patel/);
    v = view(await actions.answerQuestion(jobId, "story", "Tom Hughes and I rebuilt the rates model."));
    expect(v.confirmPerson).toEqual({ name: "James Patel" });
    v = view(await actions.confirmPersonAction(jobId, "James Patel", false));
    expect(v.confirmPerson).toEqual({ name: "Tom Hughes" });
    const p = await prompt();
    expect(p).not.toMatch(/James|Patel|Tom Hughes/);
    expect(p).toContain("a Northbridge Capital associate and I rebuilt the rates model.");
  });

  it("does not take the company or event words for a person", async () => {
    const jobId = seedNorthbridgeJob();
    await actions.openCoverLetter(jobId);
    await researchSettled();
    const v = view(await actions.answerQuestion(jobId, "why_firm", "At the Spring Insight Day Northbridge Capital showed us the Markets floor."));
    expect(v.confirmPerson).toBeNull();
  });
});

describe("edits and Ready", () => {
  it("markReady fails while the gate fails and succeeds after confirmTrue, writing the PDF and XP once", async () => {
    const jobId = seedNorthbridgeJob();
    const v = await interview(jobId);
    const outputId = v.outputs[0].id;
    const events = await drain(jobId, outputId);
    const done = events.at(-1)!;
    expect(done.event).toBe("done");
    let out = (done.data as CardView).outputs[0];
    expect(out.text.trimEnd().endsWith("Yours faithfully,\nAlex Morgan")).toBe(true);
    expect(out.canReady.ok).toBe(false);

    out = view(await actions.markReady(jobId, outputId)).outputs[0];
    expect(out.status).toBe("draft");

    for (const s of out.spans.filter((x) => x.kind === "ai" && x.flag)) {
      out = view(await actions.confirmTrue(jobId, outputId, s.start)).outputs[0];
    }
    expect(out.canReady).toEqual({ ok: true });
    const facts = db.select().from(confirmedFacts).where(eq(confirmedFacts.user_id, U)).all();
    expect(facts.length).toBeGreaterThan(0);

    const ready = view(await actions.markReady(jobId, outputId));
    expect(ready.outputs[0].status).toBe("ready");
    const pdf = ready.outputs[0].pdfPath!;
    expect(pdf.startsWith(`${U}/`)).toBe(true);
    expect(existsSync(resolveFile("letters", pdf))).toBe(true);
    await actions.markReady(jobId, outputId);
    expect(db.select().from(xpEvents).where(and(eq(xpEvents.type, "cover_letter_ready"), eq(xpEvents.job_id, jobId))).all())
      .toMatchObject([{ xp: 20 }]);
  });

  it("saveText makes the edit the student's, resets Ready, and undoEdit restores the previous text", async () => {
    const jobId = seedNorthbridgeJob();
    const v = await interview(jobId);
    const outputId = v.outputs[0].id;
    await drain(jobId, outputId);
    const before = view(await actions.openCoverLetter(jobId)).outputs[0];
    const at = before.text.indexOf("We placed 3rd of 62 teams.");
    expect(at).toBeGreaterThan(0);
    const edited = before.text.slice(0, at) + "We placed third." + before.text.slice(at + "We placed 3rd of 62 teams.".length);
    const after = view(await actions.saveText(jobId, outputId, edited)).outputs[0];
    expect(after.text).toBe(edited);
    const mine = after.spans.find((s) => s.start <= at && s.end >= at + 3);
    expect(mine?.kind).toBe("theirs");
    expect(after.spans.every((s) => s.end <= edited.length)).toBe(true);
    const undone = view(await actions.undoEdit(jobId, outputId)).outputs[0];
    expect(undone.text).toBe(before.text);
    expect(undone.spans).toEqual(before.spans);
  });

  it("addFieldOutput adds a field answer with its own limit", async () => {
    const jobId = seedNorthbridgeJob();
    await actions.openCoverLetter(jobId);
    await researchSettled();
    const v = view(await actions.addFieldOutput(jobId, "Why Northbridge?", { unit: "words", max: 200 }));
    expect(v.outputs).toHaveLength(2);
    expect(v.outputs[1]).toMatchObject({ target: { kind: "field", label: "Why Northbridge?" }, mode: "field_answer", limit: { unit: "words", max: 200 } });
  });

  it("setMode restarts the output as an empty draft in the new mode, undoable", async () => {
    const jobId = seedNorthbridgeJob();
    const v = await interview(jobId);
    const outputId = v.outputs[0].id;
    await drain(jobId, outputId);
    const before = view(await actions.openCoverLetter(jobId)).outputs[0];
    let o = view(await actions.setMode(jobId, outputId, "field_answer")).outputs[0];
    expect(o).toMatchObject({ mode: "field_answer", limit: { unit: "words", max: 300 }, text: "", spans: [], lint: [], status: "draft" });
    o = view(await actions.setMode(jobId, outputId, "short_note")).outputs[0];
    expect(o).toMatchObject({ mode: "short_note", limit: null });
    expect(view(await actions.setMode(jobId, outputId, "field_answer", { unit: "chars", max: 1000 })).outputs[0].limit).toEqual({ unit: "chars", max: 1000 });
    expect(await actions.setMode(jobId, outputId, "skip")).toHaveProperty("error");
    expect(view(await actions.undoEdit(jobId, outputId)).outputs[0].text).toBe(before.text);
  });

  it("rejects bad input from the client", async () => {
    expect(await actions.openCoverLetter("not-a-uuid")).toEqual({ error: "Unknown job" });
    const jobId = seedNorthbridgeJob();
    await actions.openCoverLetter(jobId);
    await researchSettled();
    expect(await actions.answerQuestion(jobId, "nope" as never, "x")).toHaveProperty("error");
    expect(await actions.saveText(jobId, crypto.randomUUID(), "x")).toHaveProperty("error");
  });
});

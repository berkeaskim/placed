import { existsSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db/client";
import { autopilotPacks, companyResearch, confirmedFacts, coverLetters, xpEvents } from "@/lib/db/schema";
import { resolveFile } from "@/lib/files";
import { buildDraftPrompt } from "@/lib/cover-letter/draft";
import { draftInputFor, openCard, researchSettled, retryResearch, type CardView } from "@/lib/cover-letter/service";
import { runGeneration } from "@/lib/cover-letter/generate";
import { getOrCreateLetter, upsertOutput } from "@/lib/cover-letter/store";
import type { Span } from "@/lib/cover-letter/types";
import { NO_VERDICT } from "@/lib/cover-letter/verify";
import * as actions from "@/app/(app)/jobs/[id]/cover-letter-actions";
import { letterFilename } from "@/lib/cover-letter/pdf";
import { letterWords } from "@/lib/cover-letter/rules";
import { FIXTURE_ANSWERS, FIXTURE_FACTS, FIXTURE_JD_LINES, FIXTURE_REF } from "./fixtures";

const FIXTURE_JD_LINES_NO_REF = FIXTURE_JD_LINES.filter((l) => !l.includes(FIXTURE_REF));
import { seedNorthbridgeJob, seedStudent, U } from "./seed";

vi.stubEnv("AI_MODE", "fixture");
// Full pipelines (draft, judge, repair, PDF render) run several times slower on CI runners than locally.
vi.setConfig({ testTimeout: 20_000 });
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

describe("Autopilot field targets", () => {
  it("a why-us field on a 'no cover letter' posting is still a field answer, with the form's word limit", async () => {
    const jobId = seedNorthbridgeJob(["Please note: no cover letter is required."]);
    db.insert(autopilotPacks).values({ user_id: U, job_id: jobId, form: { ats: "greenhouse", url: "https://x/apply", fields: [
      { key: "why_us", label: "Why do you want to join us?", type: "textarea", required: true, options: [], wordLimit: 200, target: "#why_us" },
    ] } }).run();
    const v = await openCard(U, jobId, { kind: "field", fieldKey: "why_us", label: "Why do you want to join us?" });
    await researchSettled();
    expect(v.outputs[0]).toMatchObject({ mode: "field_answer", limit: { unit: "words", max: 200 } });
    // The posting's own upload still takes no letter.
    expect((await openCard(U, jobId)).outputs.find((o) => o.target.kind === "upload")?.mode).toBe("skip");
  });
});

describe("research failure", () => {
  it("saves a lookup that threw as failed (not 'needs a key'), and retryResearch runs it again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.delete(companyResearch).run();
    const jobId = seedNorthbridgeJob(undefined, "fail");
    await openCard(U, jobId);
    await researchSettled();
    const v = await openCard(U, jobId);
    expect(v.researchState).toBe("failed");
    const notes = () => v2.chat.filter((m) => m.kind === "research");
    let v2 = v;
    expect(notes()).toHaveLength(1);
    expect(notes()[0].text).toMatch(/didn't work this time/);
    const again = await retryResearch(U, jobId);
    expect(again.researchState).toBe("running");
    await researchSettled();
    v2 = await openCard(U, jobId);
    expect(v2.researchState).toBe("failed");
    expect(notes()).toHaveLength(2);
    vi.restoreAllMocks();
  });

  it("retryResearch leaves finished research alone", async () => {
    const jobId = seedNorthbridgeJob();
    await openCard(U, jobId);
    await researchSettled();
    expect((await retryResearch(U, jobId)).researchState).toBe("done");
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
    // The posting's reference is in the job text, so the opening that quotes it is sourced: one deliberate catch is left.
    expect(out.spans.filter((s) => s.flag).map((s) => s.flag)).toEqual(["unsupported number"]);

    out = view(await actions.markReady(jobId, outputId)).outputs[0];
    expect(out.status).toBe("draft");

    for (const s of out.spans.filter((x) => x.kind === "ai" && x.flag)) {
      out = view(await actions.confirmTrue(jobId, outputId, s.start, "I ran the society's trading fund")).outputs[0];
    }
    expect(out.canReady).toEqual({ ok: true });
    // 09 #4: the student's own words are saved, never the AI sentence
    const facts = db.select().from(confirmedFacts).where(eq(confirmedFacts.user_id, U)).all();
    expect(facts.map((f) => [f.claim, f.source])).toContainEqual(["I ran the society's trading fund", "cover_letter_confirm"]);

    const ready = view(await actions.markReady(jobId, outputId));
    expect(ready.outputs[0].status).toBe("ready");
    // The download is named First-Last_Cover-Letter_Company_YYYY-MM.pdf.
    expect(ready.outputs[0].pdfName).toBe(letterFilename("Alex", "Morgan", "Northbridge Capital", new Date()));
    // The word chip counts what the length band counts: the body only.
    expect(ready.outputs[0].words).toBe(letterWords(ready.outputs[0].text, "full_letter"));
    expect(ready.outputs[0].words).toBeLessThan(ready.outputs[0].text.split(/\s+/).length);
    const pdf = ready.outputs[0].pdfPath!;
    expect(pdf.startsWith(`${U}/`)).toBe(true);
    expect(existsSync(resolveFile("letters", pdf))).toBe(true);
    await actions.markReady(jobId, outputId);
    expect(db.select().from(xpEvents).where(and(eq(xpEvents.type, "cover_letter_ready"), eq(xpEvents.job_id, jobId))).all())
      .toMatchObject([{ xp: 20 }]);
  });

  it("confirmTrue refuses a sentence with a blocking hit, the greeting, the sign-off and unsourced text", async () => {
    const jobId = seedNorthbridgeJob();
    await actions.openCoverLetter(jobId);
    await researchSettled();
    const letter = getOrCreateLetter(U, jobId);
    const text = "Dear Team at Rival Capital,\n\nI am applying for the Summer Analyst – Markets role at Northbridge Capital. I led a desk at [Company Name] with 9 traders. I am keen. I ran a fund with 7 people.\n\nYours faithfully,\nAlex Morgan";
    const at = (t: string) => text.indexOf(t);
    const ai = (t: string, flag: string): Span => ({ start: at(t), end: at(t) + t.length, kind: "ai", refs: [], flag });
    const spans: Span[] = [
      ai("Dear Team at Rival Capital,", "check the greeting"),
      ai("I led a desk at [Company Name] with 9 traders.", "unsupported number"),
      ai("I am keen.", "no source"),
      ai("I ran a fund with 7 people.", "unsupported number"),
      ai("Yours faithfully,\nAlex Morgan", "check the sign-off"),
    ];
    const o = upsertOutput(letter.id, { kind: "upload" }, { text, spans, lint: [], status: "draft" });
    const facts = () => db.select().from(confirmedFacts).where(eq(confirmedFacts.user_id, U)).all().length;
    const n = facts();
    for (const s of spans.filter((x) => x.flag !== "unsupported number" || x.start === at("I led"))) {
      const r = await actions.confirmTrue(jobId, o.id, s.start);
      expect(r).toHaveProperty("error");
      expect((r as { error: string }).error).toMatch(/can't|cannot|edit/i);
    }
    expect(facts()).toBe(n);
    const ok = view(await actions.confirmTrue(jobId, o.id, at("I ran a fund"))).outputs[0];
    expect(ok.spans.find((s) => s.start === at("I ran a fund"))?.kind).toBe("theirs");
    // 09 #4: with no words of the student's own, the AI sentence stays in this letter and is never saved as a fact
    expect(facts()).toBe(n);
  });

  it("09 #4: 'would work for any firm' and an AI-inferred motivation can't be confirmed; three taps per letter at most", async () => {
    const jobId = seedNorthbridgeJob();
    await actions.openCoverLetter(jobId);
    await researchSettled();
    const letter = getOrCreateLetter(U, jobId);
    const text = "Dear Hiring Manager,\n\nNorthbridge is a great firm. This taught me resilience. I ran a fund. I chaired a club. I wrote a blog. I sold tickets.\n\nYours faithfully,\nAlex Morgan";
    const at = (t: string) => text.indexOf(t);
    const ai = (t: string, flag: string): Span => ({ start: at(t), end: at(t) + t.length, kind: "ai", refs: [], flag });
    const spans: Span[] = [ai("Northbridge is a great firm.", "would work for any firm"), ai("This taught me resilience.", "AI-inferred motivation: say it in your own words"),
      ai("I ran a fund.", "unsupported number"), ai("I chaired a club.", "unsupported number"), ai("I wrote a blog.", "unsupported number"), ai("I sold tickets.", "unsupported number")];
    const o = upsertOutput(letter.id, { kind: "upload" }, { text, spans, lint: [], status: "draft" });
    for (const t of ["Northbridge is a great firm.", "This taught me resilience."]) {
      expect((await actions.confirmTrue(jobId, o.id, at(t))) as { error?: string }).toHaveProperty("error");
    }
    for (const t of ["I ran a fund.", "I chaired a club.", "I wrote a blog."]) expect(await actions.confirmTrue(jobId, o.id, at(t))).not.toHaveProperty("error");
    expect(((await actions.confirmTrue(jobId, o.id, at("I sold tickets."))) as { error?: string }).error).toMatch(/own words/);
  });

  it("confirmTrue on a firm sentence makes it theirs, shown as confirmed, without saving it as a fact about the student", async () => {
    const jobId = seedNorthbridgeJob();
    await actions.openCoverLetter(jobId);
    await researchSettled();
    const letter = getOrCreateLetter(U, jobId);
    const text = "Dear Hiring Manager,\n\nI am applying for the Summer Analyst – Markets role at Northbridge Capital. Northbridge is a great place to learn. I ran a fund with 7 people.\n\nYours faithfully,\nAlex Morgan";
    const at = (t: string) => text.indexOf(t);
    const firm = "Northbridge is a great place to learn.";
    const me = "I ran a fund with 7 people.";
    const o = upsertOutput(letter.id, { kind: "upload" }, { text, status: "draft", lint: [], spans: [
      { start: at(firm), end: at(firm) + firm.length, kind: "ai", refs: ["jd"], flag: "not in the job post" },
      { start: at(me), end: at(me) + me.length, kind: "ai", refs: ["x1-b0"], flag: "unsupported number" },
    ] });
    const facts = () => db.select().from(confirmedFacts).where(eq(confirmedFacts.user_id, U)).all().map((f) => f.claim);
    const n = facts().length;
    let out = view(await actions.confirmTrue(jobId, o.id, at(firm))).outputs[0];
    expect(out.spans.find((s) => s.start === at(firm))).toMatchObject({ kind: "theirs", confirmed: true });
    expect(facts()).toHaveLength(n);
    out = view(await actions.confirmTrue(jobId, o.id, at(me), "I ran a student fund with 7 members")).outputs[0];
    expect(out.spans.find((s) => s.start === at(me))).toMatchObject({ kind: "theirs", confirmed: true });
    expect(facts()).toHaveLength(n + 1);
    expect(facts()).toContain("I ran a student fund with 7 members"); // the student's words, not the AI sentence
  });

  it("confirmTrue clears \"couldn't check this claim about the firm\" without saving it as a fact about the student", async () => {
    const jobId = seedNorthbridgeJob();
    await actions.openCoverLetter(jobId);
    await researchSettled();
    const letter = getOrCreateLetter(U, jobId);
    const text = "Dear Hiring Manager,\n\nThat is why I am applying to Northbridge.\n\nYours faithfully,\nAlex Morgan";
    const s = "That is why I am applying to Northbridge.";
    const at = text.indexOf(s);
    const o = upsertOutput(letter.id, { kind: "upload" }, { text, status: "draft", lint: [], spans: [
      { start: at, end: at + s.length, kind: "ai", refs: [], flag: NO_VERDICT },
    ] });
    const facts = () => db.select().from(confirmedFacts).where(eq(confirmedFacts.user_id, U)).all().length;
    const n = facts();
    const out = view(await actions.confirmTrue(jobId, o.id, at)).outputs[0];
    expect(out.spans.find((x) => x.start === at)).toMatchObject({ kind: "theirs", confirmed: true });
    expect(out.spans.filter((x) => x.kind === "ai" && x.flag)).toEqual([]);
    expect(facts()).toBe(n);
  });

  it("takes the posting's reference from the job text, or none", async () => {
    const withRef = seedNorthbridgeJob([...FIXTURE_JD_LINES_NO_REF, "Job reference: NB-2027-MKT"]);
    let v = await openCard(U, withRef);
    await researchSettled();
    expect((await draftInputFor(U, withRef, v.outputs[0].id)).ref).toBe("NB-2027-MKT");
    const none = seedNorthbridgeJob(FIXTURE_JD_LINES_NO_REF);
    v = await openCard(U, none);
    await researchSettled();
    expect((await draftInputFor(U, none, v.outputs[0].id)).ref).toBeNull();
    const fixture = seedNorthbridgeJob();
    v = await openCard(U, fixture);
    await researchSettled();
    expect((await draftInputFor(U, fixture, v.outputs[0].id)).ref).toBe(FIXTURE_REF);
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

  it("stores a draft with the spacing the paper shows, so reading it back unedited saves nothing", async () => {
    // fixtures/ai/coverLetterDraft/spaced.txt: a space before every marker, as small models write it.
    const jobId = seedNorthbridgeJob(undefined, "spaced");
    const v = await interview(jobId);
    const outputId = v.outputs[0].id;
    await drain(jobId, outputId);
    const before = view(await actions.openCoverLetter(jobId)).outputs[0];
    expect(before.text).not.toMatch(/ {2}/);
    // The contenteditable's text after a focus and blur: pre-line collapses spaces, each paragraph trimmed.
    const read = before.text.split(/\n[ \t]*\n/).map((p) => p.replace(/ {2,}/g, " ").trim()).join("\n\n");
    const after = view(await actions.saveText(jobId, outputId, `${read}  `)).outputs[0];
    expect(after.text).toBe(before.text);
    expect(after.spans).toEqual(before.spans);
    expect(after.canReady).toEqual(before.canReady);
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
    // Undo walks back through each switch, restoring the mode and limit with the text.
    expect(view(await actions.undoEdit(jobId, outputId)).outputs[0]).toMatchObject({ mode: "full_letter", limit: null, text: before.text, spans: before.spans });
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

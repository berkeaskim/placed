import { describe, expect, it } from "vitest";
import { cardReducer, changedParagraph, initialCardState, settle, showsTyping, type CardState, type UserAction } from "@/components/cover-letter/card-state";
import type { CardView, OutputView } from "@/lib/cover-letter/service";

const output = (o: Partial<OutputView> = {}): OutputView => ({
  id: "o1", target: { kind: "upload" }, mode: "full_letter", limit: null, status: "draft", text: "", spans: [], lint: [],
  words: 0, canReady: { ok: false, reasons: ["The letter is empty"] }, pdfPath: null, pdfName: null, ...o,
});
const view = (v: Partial<CardView> = {}): CardView => ({
  letterId: "l1", company: "Northbridge", role: "Analyst", chat: [], next: null, researchState: "done", draftState: "idle",
  facts: [], outputs: [output()], feedbackOnly: false, noLetter: false, aiPolicy: null, confirmPerson: null, savedStory: null, ...v,
});
const QUESTION = { id: "why_firm" as const, text: "Why Northbridge?", chips: ["Skip"] };

const opened = (v = view()) => cardReducer(initialCardState(), { type: "view", view: v });
const drafting = (): CardState => {
  let s = opened();
  s = cardReducer(s, { type: "start", action: { kind: "draft", outputId: "o1" } });
  s = cardReducer(s, { type: "phase", phase: "thinking" });
  return cardReducer(s, { type: "delta", visible: "Dear " });
};

describe("cardReducer", () => {
  it("settles a fresh view into the state its next step implies", () => {
    expect(settle(view({ next: QUESTION }), "o1")).toBe("asking");
    expect(settle(view({ next: { id: "wait_research" } }), "o1")).toBe("researching");
    expect(settle(view({ next: { id: "facts", text: "Which?", chips: ["Skip"] } }), "o1")).toBe("picking");
    expect(settle(view(), "o1")).toBe("idle");
    expect(settle(view({ outputs: [output({ text: "Dear team," })] }), "o1")).toBe("done");
    expect(opened().outputId).toBe("o1");
  });

  it("appends delta text only while drafting or editing", () => {
    const s = drafting();
    expect(s.state).toBe("drafting");
    expect(cardReducer(s, { type: "delta", visible: "Northbridge," }).visible).toBe("Dear Northbridge,");

    let e = cardReducer(opened(view({ outputs: [output({ text: "A.\n\nB." })] })), { type: "start", action: { kind: "edit", outputId: "o1", edit: "shorter" } });
    e = cardReducer(e, { type: "phase", phase: "target", paragraph: 1 });
    expect(e.state).toBe("editing");
    expect(e.editing).toBe(1);
    expect(cardReducer(e, { type: "delta", visible: "Short." }).visible).toBe("Short.");

    for (const st of [opened(view({ next: QUESTION })), opened(), cardReducer(opened(), { type: "error", message: "x" })]) {
      expect(cardReducer(st, { type: "delta", visible: "late" }).visible).toBe("");
    }
    const checking = cardReducer(s, { type: "phase", phase: "checking" });
    expect(checking.state).toBe("checking");
    expect(cardReducer(checking, { type: "delta", visible: " more" }).visible).toBe("Dear ");
  });

  it("moves to error from any state, with retry set to the last action", () => {
    const answer: UserAction = { kind: "answer", questionId: "why_firm", text: "Their insight day" };
    const asking = cardReducer(opened(view({ next: QUESTION })), { type: "start", action: answer });
    const a = cardReducer(asking, { type: "error", message: "Something went wrong." });
    expect(a.state).toBe("error");
    expect(a.error).toBe("Something went wrong.");
    expect(a.retry).toEqual(answer);
    expect(a.pending).toBe(false);

    const d = cardReducer(drafting(), { type: "error", message: "Model down" });
    expect(d.state).toBe("error");
    expect(d.retry).toEqual({ kind: "draft", outputId: "o1" });
    expect(d.gen).toBeNull();
    expect(d.visible).toBe("");

    const idle = cardReducer(initialCardState(), { type: "error", message: "No job" });
    expect(idle.state).toBe("error");
  });

  it("done settles to done, clears editing and adds the a → b words note", () => {
    let s = cardReducer(opened(view({ outputs: [output({ text: "A b c.\n\nD e f g.", words: 7 })] })), {
      type: "start", action: { kind: "edit", outputId: "o1", edit: "shorter" }, say: "Make it shorter",
    });
    s = cardReducer(s, { type: "phase", phase: "target", paragraph: 1 });
    s = cardReducer(s, { type: "delta", visible: "D e." });
    const done = cardReducer(s, { type: "done", view: view({ outputs: [output({ text: "A b c.\n\nD e.", words: 5 })] }) });
    expect(done.state).toBe("done");
    expect(done.editing).toBeNull();
    expect(done.gen).toBeNull();
    expect(done.visible).toBe("");
    expect(done.scan).toEqual({ paragraph: 1, n: 1 });
    expect(done.local.map((m) => m.from)).toEqual(["me", "bot"]);
    expect(done.local[1].text).toBe("Done: 7 → 5 words.");
    expect(done.local[1].undo).toEqual({ outputId: "o1", used: false, paragraph: 1 });
  });

  it("a new user action during drafting interrupts it and asks for the abort", () => {
    const s = drafting();
    const answered = cardReducer(s, { type: "start", action: { kind: "answer", questionId: "story", text: "I ran the desk" } });
    expect(answered.state).toBe("asking");
    expect(answered.abort).toBe(true);
    expect(answered.gen).toBeNull();
    expect(answered.visible).toBe("");

    const edited = cardReducer(s, { type: "start", action: { kind: "edit", outputId: "o1", edit: "add_close" } });
    expect(edited.state).toBe("editing");
    expect(edited.abort).toBe(true);
    expect(edited.gen).toEqual({ kind: "edit", outputId: "o1", edit: "add_close" });

    // Nothing was streaming: nothing to abort.
    const calm = cardReducer(opened(view({ next: QUESTION })), { type: "start", action: { kind: "answer", questionId: "why_firm", text: null } });
    expect(calm.abort).toBe(false);
  });

  it("ignores stream events once the generation is gone, and keeps phase while streaming on a stray view", () => {
    const interrupted = cardReducer(drafting(), { type: "start", action: { kind: "undo", outputId: "o1" } });
    expect(cardReducer(interrupted, { type: "phase", phase: "checking" }).state).toBe(interrupted.state);
    expect(cardReducer(drafting(), { type: "view", view: view({ next: QUESTION }) }).state).toBe("drafting");
  });

  it("arms the auto-draft only after the student's own answer, and disarms when a draft starts", () => {
    const s = cardReducer(opened(view({ next: QUESTION })), { type: "start", action: { kind: "answer", questionId: "why_firm", text: "Insight day" } });
    const answered = cardReducer(s, { type: "view", view: view() });
    expect(answered.armed).toBe(true);
    expect(cardReducer(answered, { type: "start", action: { kind: "draft", outputId: "o1" } }).armed).toBe(false);
    expect(opened().armed).toBe(false);
  });

  it("switching length on a written letter says it was kept, with Undo", () => {
    const s = cardReducer(opened(view({ outputs: [output({ text: "Dear team,", words: 2 })] })), { type: "start", action: { kind: "mode", outputId: "o1", mode: "short_note" } });
    const after = cardReducer(s, { type: "view", view: view({ outputs: [output({ mode: "short_note" })] }) });
    expect(after.state).toBe("idle");
    expect(after.local.at(-1)).toMatchObject({ from: "bot", text: "Switched to a startup note. Your previous letter is saved.", undo: { outputId: "o1", used: false, paragraph: null } });
  });

  it("echoes a chat answer at once instead of adding it to the session-only messages", () => {
    const s = cardReducer(opened(view({ next: QUESTION })), { type: "start", action: { kind: "answer", questionId: "why_firm", text: "Insight day" }, say: "Insight day" });
    expect(s.echo).toBe("Insight day");
    expect(s.local).toEqual([]);
  });

  it("lights the student's own sentence green as soon as it closes", () => {
    let s = drafting();
    s = cardReducer(s, { type: "delta", visible: "team,\n\nI ran the desk. ", closed: [{ text: "Dear team,", about: null }] });
    s = cardReducer(s, { type: "delta", visible: "", closed: [{ text: "I ran the desk.", about: "you" }] });
    expect(s.lit).toEqual([{ start: s.visible.indexOf("I ran"), end: s.visible.indexOf("I ran") + "I ran the desk.".length }]);
    expect(s.litTexts).toEqual(["I ran the desk."]);
    const done = cardReducer(s, { type: "done", view: view({ outputs: [output({ text: "Dear team,\n\nI ran the desk.", words: 6 })] }) });
    expect(done.sweep).toBe(true);
    expect(done.litTexts).toEqual(["I ran the desk."]);
    expect(cardReducer(done, { type: "swept" }).sweep).toBe(false);
  });

  it("Retry on a failed lookup waits on the server without typing dots, then shows research running", () => {
    const failed = opened(view({ researchState: "failed", next: QUESTION }));
    const start = cardReducer(failed, { type: "start", action: { kind: "research" } });
    expect(start).toMatchObject({ pending: true, state: "asking" });
    expect(showsTyping(start)).toBe(false);
    const back = cardReducer(start, { type: "view", view: view({ researchState: "running", next: { id: "wait_research" } }) });
    expect(back).toMatchObject({ pending: false, state: "researching" });
  });

  it("research that outlasts the polling cap becomes an error with retry, cleared by reopening", () => {
    const running = opened(view({ researchState: "running", next: { id: "wait_research" } }));
    const stalled = cardReducer(running, { type: "stalled" });
    expect(stalled.state).toBe("error");
    expect(stalled.stalled).toBe(true);
    expect(stalled.retry).toEqual({ kind: "open" });
    // Carry on without research: the facts question is skipped and the next one asked; the block stays still.
    const goOn = cardReducer(cardReducer(stalled, { type: "start", action: { kind: "pick", factIds: [] }, say: "Carry on without research" }), { type: "view", view: view({ researchState: "running", next: QUESTION }) });
    expect(goOn.state).toBe("asking");
    expect(goOn.stalled).toBe(true);
    const reopened = cardReducer(cardReducer(stalled, { type: "start", action: { kind: "open" } }), { type: "view", view: view({ researchState: "running", next: { id: "wait_research" } }) });
    expect(reopened.stalled).toBe(false);
    expect(reopened.state).toBe("researching");
    expect(cardReducer(opened(), { type: "stalled" }).state).toBe("idle");
  });

  it("undo breathes the edited paragraph, then restores it in reverse and glows", () => {
    const after = output({ text: "Dear team,\n\nShort.\n\nYours sincerely,", words: 4 });
    let s = opened(view({ outputs: [after] }));
    s = cardReducer(s, { type: "start", action: { kind: "undo", outputId: "o1", paragraph: 1 } });
    expect(s.state).toBe("editing");
    expect(s.editing).toBe(1);
    expect(showsTyping(s)).toBe(false);
    s = cardReducer(s, { type: "view", view: view({ outputs: [output({ text: "Dear team,\n\nA much longer opening.\n\nYours sincerely,", words: 7 })] }) });
    expect(s.state).toBe("done");
    expect(s.editing).toBeNull();
    expect(s.restore).toMatchObject({ paragraph: 1, from: "Short.", removed: false });
    const r = cardReducer(s, { type: "restored" });
    expect(r.restore).toBeNull();
    expect(r.scan).toEqual({ paragraph: 1, n: s.scan.n + 1 });
  });

  it("finds the changed or removed paragraph for an undo", () => {
    expect(changedParagraph("A\n\nB\n\nC", "A\n\nX\n\nC")).toEqual({ paragraph: 1, removed: false });
    expect(changedParagraph("A\n\nB\n\nNew close\n\nSign", "A\n\nB\n\nSign")).toEqual({ paragraph: 2, removed: true });
    expect(changedParagraph("A\n\nB", "X\n\nY")).toBeNull();
    expect(changedParagraph("", "A")).toBeNull();
  });

  it("shows typing dots only for chat replies", () => {
    const save = cardReducer(opened(view({ outputs: [output({ text: "x" })] })), { type: "start", action: { kind: "save", outputId: "o1", text: "y" } });
    expect(showsTyping(save)).toBe(false);
    const answer = cardReducer(opened(view({ next: QUESTION })), { type: "start", action: { kind: "answer", questionId: "why_firm", text: "x" } });
    expect(showsTyping(answer)).toBe(true);
  });
});

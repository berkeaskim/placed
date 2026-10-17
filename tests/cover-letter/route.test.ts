import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db/client";
import { coverLetters } from "@/lib/db/schema";
import { openCard, researchSettled, type CardView } from "@/lib/cover-letter/service";
import { seedNorthbridgeJob, seedStudent, U } from "./seed";

vi.stubEnv("AI_MODE", "fixture");
const route = await import("@/app/api/cover-letter/[jobId]/draft/route");
beforeAll(() => seedStudent());

const call = (jobId: string, body: unknown, signal?: AbortSignal) =>
  route.POST(new Request("http://x", { method: "POST", body: JSON.stringify(body), signal }), { params: Promise.resolve({ jobId }) });

/** Parses `event: x\ndata: json\n\n` frames; `onEvent` may abort mid-stream. */
async function readSse(res: Response, onEvent?: (e: { event: string; data: unknown }) => void) {
  const out: { event: string; data: unknown }[] = [];
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true as const }));
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let cut: number;
    while ((cut = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, cut);
      buf = buf.slice(cut + 2);
      const event = /^event: (.*)$/m.exec(frame)?.[1] ?? "";
      const data = JSON.parse(/^data: (.*)$/m.exec(frame)?.[1] ?? "null");
      out.push({ event, data });
      onEvent?.({ event, data });
    }
  }
  return out;
}

async function freshLetter(lines?: string[], extId?: string) {
  const jobId = seedNorthbridgeJob(lines, extId);
  const v = await openCard(U, jobId);
  await researchSettled();
  return { jobId, outputId: v.outputs[0].id, letterId: v.letterId };
}
const draftState = (letterId: string) => db.select().from(coverLetters).where(eq(coverLetters.id, letterId)).get()!.draft_state;

describe("POST /api/cover-letter/[jobId]/draft", () => {
  it("streams phase:thinking, then deltas, then done with a non-empty output", async () => {
    const { jobId, outputId, letterId } = await freshLetter();
    const res = await call(jobId, { outputId, kind: "draft" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const events = await readSse(res);
    expect(events[0]).toEqual({ event: "phase", data: { phase: "thinking" } });
    const deltas = events.filter((e) => e.event === "delta");
    expect(deltas.length).toBeGreaterThanOrEqual(5);
    expect(deltas.every((d) => typeof (d.data as { visible: string }).visible === "string")).toBe(true);
    expect(events.some((e) => e.event === "phase" && (e.data as { phase: string }).phase === "checking")).toBe(true);
    const done = events.at(-1)!;
    expect(done.event).toBe("done");
    const card = done.data as CardView;
    expect(card.outputs[0].text.length).toBeGreaterThan(200);
    expect(card.outputs[0].spans.length).toBeGreaterThan(0);
    expect(card.draftState).toBe("done");
    expect(draftState(letterId)).toBe("done");
  });

  it("streams an edit: target, deltas, done, and undo is available", async () => {
    const { jobId, outputId } = await freshLetter();
    await readSse(await call(jobId, { outputId, kind: "draft" }));
    const events = await readSse(await call(jobId, { outputId, kind: "edit", edit: "shorter" }));
    expect(events.some((e) => e.event === "phase" && (e.data as { phase: string }).phase === "target")).toBe(true);
    expect(events.some((e) => e.event === "delta")).toBe(true);
    expect(events.at(-1)!.event).toBe("done");
  });

  it("marks the letter interrupted when the client aborts mid-stream", async () => {
    const { jobId, outputId, letterId } = await freshLetter();
    const ac = new AbortController();
    let deltas = 0;
    await readSse(await call(jobId, { outputId, kind: "draft" }, ac.signal), (e) => { if (e.event === "delta" && ++deltas === 3) ac.abort(); });
    await vi.waitFor(() => expect(draftState(letterId)).toBe("interrupted"));
  });

  it("returns 409 for a feedback-only letter, 400 for a bad body and 404 for an unknown output", async () => {
    const fb = await freshLetter(["Please do not use AI to write your application."]);
    expect((await call(fb.jobId, { outputId: fb.outputId, kind: "draft" })).status).toBe(409);
    const ok = await freshLetter();
    expect((await call(ok.jobId, { outputId: ok.outputId, kind: "nope" })).status).toBe(400);
    expect((await call(ok.jobId, { outputId: crypto.randomUUID(), kind: "draft" })).status).toBe(404);
    expect((await call("not-a-uuid", { outputId: ok.outputId, kind: "draft" })).status).toBe(400);
  });

  it("emits an error event and leaves no letter streaming when the AI call fails", async () => {
    // fixtures/ai/coverLetterEvidence/fail.json does not parse, so the evidence call throws.
    const { jobId, outputId, letterId } = await freshLetter(undefined, "fail");
    const events = await readSse(await call(jobId, { outputId, kind: "draft" }));
    expect(events.at(-1)!.event).toBe("error");
    expect(draftState(letterId)).not.toBe("streaming");
  });
});

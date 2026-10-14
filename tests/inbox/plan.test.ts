import { describe, expect, it, vi } from "vitest";
import { CLASSIFY_CONCURRENCY, MAX_NEW_PER_SYNC, classifierFor, claimEffect, planInboxEvents, safeClassify, unseenBatch } from "@/lib/inbox/plan";
import { targetStatus } from "@/lib/inbox/rules";
import type { AppRef, Classification, RawEmail } from "@/lib/inbox/types";

const app: AppRef = { id: "a1", jobId: "j1", status: "saved", company: "Lendable", title: "Credit Analyst Intern" };
const mail = (id: string, date: string): RawEmail => ({ id, from: "x", subject: id, date, text: "" });
const cls = (kind: Classification["kind"]): Classification => ({ kind, company: "Lendable", roleHint: null, deadline: null, actionUrl: null, confidence: 0.9 });

describe("planInboxEvents", () => {
  it("processes oldest first so a later email builds on an earlier move", async () => {
    const byId: Record<string, Classification> = { a: cls("received"), b: cls("interview") };
    const out = await planInboxEvents({
      apps: [app], seen: new Set(),
      emails: [mail("b", "2026-10-12T00:00:00Z"), mail("a", "2026-10-01T00:00:00Z")], // newest first, as Gmail lists
      classify: async (e) => byId[e.id],
    });
    expect(out.map((p) => [p.email.id, p.decision, p.prevStatus])).toEqual([
      ["a", { effect: "moved", to: "applied" }, "saved"],
      ["b", { effect: "moved", to: "interview" }, "applied"],
    ]);
  });
  it("skips messages already seen without classifying them", async () => {
    const classify = vi.fn(async () => cls("interview"));
    const out = await planInboxEvents({ apps: [app], seen: new Set(["a"]), emails: [mail("a", "2026-10-01T00:00:00Z")], classify });
    expect(out).toEqual([]);
    expect(classify).not.toHaveBeenCalled();
  });
  it("records a no-move event with its application (so deadlines still count)", async () => {
    const out = await planInboxEvents({
      apps: [{ ...app, status: "interview" }], seen: new Set(), emails: [mail("a", "2026-10-01T00:00:00Z")],
      classify: async () => ({ ...cls("assessment"), deadline: "2026-10-20" }),
    });
    expect(out[0]).toMatchObject({ appId: "a1", jobId: "j1", decision: { effect: "none" }, prevStatus: null });
  });
  it("a throwing classifier yields a no-op event, not a rejected sync", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await planInboxEvents({
      apps: [app], seen: new Set(), emails: [mail("a", "2026-10-01T00:00:00Z"), mail("b", "2026-10-02T00:00:00Z")],
      classify: safeClassify(async (e) => { if (e.id === "a") throw new Error("malformed"); return cls("received"); }),
    });
    expect(out).toHaveLength(2);
    expect(out[0].decision).toEqual({ effect: "none" });
    expect(out[0].failed).toBe(true);
    expect(out[1].failed).toBe(false);
    expect(out[1].decision).toEqual({ effect: "moved", to: "applied" });
  });
});

describe("target for a suggested add (targetStatus)", () => {
  it("does not move a tracked interview card on a 'received' email", () => expect(targetStatus("interview", "received")).toBeNull());
  it("does not revive a rejected card", () => expect(targetStatus("rejected", "received")).toBeNull());
  it("moves a fresh (saved) row to applied", () => expect(targetStatus("saved", "received")).toBe("applied"));
});

describe("claimEffect", () => {
  it("never claims a row as moved before the move is confirmed", () => {
    expect(claimEffect({ effect: "moved", to: "applied" })).toBe("none");
    expect(claimEffect({ effect: "suggested", reason: "unmatched" })).toBe("suggested");
    expect(claimEffect({ effect: "none" })).toBe("none");
  });
});

describe("sync cost bounds", () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => mail(`m${String(i).padStart(3, "0")}`, new Date(Date.UTC(2026, 8, 1) + i * 3_600_000).toISOString()));

  it(`classifies at most ${CLASSIFY_CONCURRENCY} emails at once`, async () => {
    let inFlight = 0, peak = 0;
    const classify = async () => {
      inFlight++; peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 2));
      inFlight--;
      return cls("other");
    };
    const out = await planInboxEvents({ apps: [app], seen: new Set(), emails: many(30), classify });
    expect(out).toHaveLength(30);
    expect(peak).toBe(CLASSIFY_CONCURRENCY);
  });

  it(`handles the newest ${MAX_NEW_PER_SYNC} unseen emails, oldest first, and counts the rest`, async () => {
    const emails = many(55).reverse(); // newest first, as Gmail lists
    const seen = new Set(["m054", "m000"]);
    const { batch, remaining } = unseenBatch(emails, seen);
    expect(batch).toHaveLength(MAX_NEW_PER_SYNC);
    expect(remaining).toBe(53 - MAX_NEW_PER_SYNC);
    expect(batch[0].id).toBe("m014");
    expect(batch.at(-1)!.id).toBe("m053");
    const classify = vi.fn(async () => cls("other"));
    const out = await planInboxEvents({ apps: [app], seen, emails, classify });
    expect(out.map((p) => p.email.id)).toEqual(batch.map((e) => e.id));
    expect(classify).toHaveBeenCalledTimes(MAX_NEW_PER_SYNC);
    expect(unseenBatch(emails.slice(0, 10), new Set()).remaining).toBe(0);
  });
});

describe("classifierFor", () => {
  const demo: Classification = { kind: "assessment", company: "Lendable", roleHint: "Credit Analyst Intern", deadline: "2026-10-16", actionUrl: "https://demo.placed.test/a", confidence: 0.95 };
  it("never calls the live classifier for the demo account", async () => {
    const live = vi.fn(async () => cls("offer"));
    const f = classifierFor(true, new Map([["d1", demo]]), live);
    const email = { ...mail("d1", "2026-10-12T00:00:00Z"), text: "Test link: https://demo.placed.test/a" };
    expect(await f(email)).toEqual(demo);
    expect((await f(mail("unknown", "2026-10-12T00:00:00Z"))).kind).toBe("other");
    expect(live).not.toHaveBeenCalled();
  });
  it("guards the demo classification like a model answer (a link not in the email is dropped)", async () => {
    const f = classifierFor(true, new Map([["d1", demo]]), vi.fn());
    expect((await f(mail("d1", "2026-10-12T00:00:00Z"))).actionUrl).toBeNull();
  });
  it("uses the live classifier for everyone else", async () => {
    const live = vi.fn(async () => cls("offer"));
    expect((await classifierFor(false, new Map([["d1", demo]]), live)(mail("d1", "2026-10-12T00:00:00Z"))).kind).toBe("offer");
    expect(live).toHaveBeenCalledOnce();
  });
});

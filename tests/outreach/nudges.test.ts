import { describe, expect, it } from "vitest";
import { FOLLOW_UP_DAYS, nudgeFor } from "@/lib/outreach/nudges";

const now = new Date("2026-10-14T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

describe("nudgeFor", () => {
  it("suggests an alumni prep question when there's an interview, naming the student's university", () => {
    const a = { status: "interview" as const, company: "IMC", lastEventAt: daysAgo(1), updatedAt: daysAgo(1) };
    expect(nudgeFor(a, now, undefined, "University of Bristol"))
      .toEqual({ text: "Interview at IMC: ask an alumnus from Bristol there a prep question.", target: "alumni", purpose: "interview_prep" });
    expect(nudgeFor(a, now)!.text).toBe("Interview at IMC: ask an alumnus from your university there a prep question.");
  });
  it(`suggests a recruiter follow-up after ${FOLLOW_UP_DAYS} days of silence on an applied card`, () => {
    expect(nudgeFor({ status: "applied", company: "Monzo", lastEventAt: daysAgo(21), updatedAt: daysAgo(30) }, now))
      .toEqual({ text: "No news from Monzo for 3 weeks: send the recruiter a polite follow-up.", target: "recruiter", purpose: "follow_up" });
    expect(nudgeFor({ status: "applied", company: "Monzo", lastEventAt: daysAgo(20), updatedAt: daysAgo(30) }, now)).toBeNull();
  });
  it("falls back to updatedAt when no email was ever seen", () => {
    expect(nudgeFor({ status: "applied", company: "Monzo", lastEventAt: null, updatedAt: daysAgo(25) }, now)?.purpose).toBe("follow_up");
  });
  it("is silent for saved, offer and rejected", () => {
    for (const s of ["saved", "offer", "rejected"] as const) expect(nudgeFor({ status: s, company: "X", lastEventAt: null, updatedAt: daysAgo(90) }, now)).toBeNull();
  });
  it("restarts the clock on a manual move newer than the last email", () => {
    expect(nudgeFor({ status: "applied", company: "Monzo", lastEventAt: daysAgo(40), updatedAt: daysAgo(5) }, now)).toBeNull();
  });
  it("ignores an unparseable lastEventAt", () => {
    expect(nudgeFor({ status: "applied", company: "Monzo", lastEventAt: "not a date", updatedAt: daysAgo(25) }, now)?.purpose).toBe("follow_up");
  });
  it("skips the follow-up when the recruiter was already messaged", () => {
    const a = { status: "applied" as const, company: "Monzo", lastEventAt: daysAgo(30), updatedAt: daysAgo(30) };
    expect(nudgeFor(a, now, new Set(["recruiter"] as const))).toBeNull();
    expect(nudgeFor(a, now, new Set(["alumni"] as const))?.purpose).toBe("follow_up");
  });
  it("skips the interview nudge when an alumnus was already messaged", () => {
    expect(nudgeFor({ status: "interview", company: "IMC", lastEventAt: daysAgo(1), updatedAt: daysAgo(1) }, now, new Set(["alumni"] as const))).toBeNull();
  });
});

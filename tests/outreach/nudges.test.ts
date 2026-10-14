import { describe, expect, it } from "vitest";
import { FOLLOW_UP_DAYS, nudgeFor } from "@/lib/outreach/nudges";

const now = new Date("2026-10-14T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

describe("nudgeFor", () => {
  it("suggests an alumni prep question when there's an interview", () => {
    expect(nudgeFor({ status: "interview", company: "IMC", lastEventAt: daysAgo(1), updatedAt: daysAgo(1) }, now))
      .toEqual({ text: "Interview at IMC: ask a UCL alumnus there a prep question.", target: "alumni", purpose: "interview_prep" });
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
});

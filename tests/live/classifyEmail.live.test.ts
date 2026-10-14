import { describe, expect, it } from "vitest";
import { classifyEmail } from "@/lib/inbox/classify";
import { demoEmails } from "@/lib/gmail/fixtures";
import type { InboxKind, RawEmail } from "@/lib/inbox/types";

/** Opt-in eval: the 8 demo emails plus 4 adversarial cases (digest, talent-community welcome, rejection, two-company interview). */
const hard: { email: RawEmail; kind: InboxKind; company: string | null }[] = [
  { kind: "other", company: null, email: { id: "h1", from: "Bright Network <hello@demo.placed.test>", subject: "10 firms hiring interns this week", date: "2026-10-10T09:00:00Z",
    text: "Goldman Sachs, Lendable and Monzo are all hiring. Apply now to secure your spot!" } },
  { kind: "other", company: null, email: { id: "h2", from: "Datadog Talent Community <noreply@demo.placed.test>", subject: "Welcome to our talent community", date: "2026-10-10T09:00:00Z",
    text: "Thanks for joining. We'll email you when roles that match your interests open." } },
  { kind: "rejection", company: "Monzo", email: { id: "h3", from: "Monzo Talent <noreply@demo.placed.test>", subject: "Your application", date: "2026-10-10T09:00:00Z",
    text: "Thank you for your interest in Monzo. Unfortunately we won't be inviting you to interview for this role." } },
  { kind: "interview", company: "IMC", email: { id: "h4", from: "Recruiting <noreply@demo.placed.test>", subject: "Interview invitation", date: "2026-10-10T09:00:00Z",
    text: "Following your application to IMC, we'd like to invite you to interview. Unlike our Optiver process, this is a single round." } },
];

describe.skipIf(!process.env.LIVE_AI)("classifyEmail eval (live model)", () => {
  const cases = [...demoEmails(new Date()).map((d) => ({ email: d.email, kind: d.classification.kind, company: d.classification.company })), ...hard];
  it.each(cases.map((c) => [c.email.id, c]))("%s", async (_id, c) => {
    const got = await classifyEmail(c.email);
    expect(got.kind).toBe(c.kind);
    if (c.company) expect(got.company?.toLowerCase()).toContain(c.company.toLowerCase().split(" ")[0]);
  }, 60_000);
});

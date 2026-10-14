import type { Classification, RawEmail } from "@/lib/inbox/types";

const DAY = 24 * 3600 * 1000;
const iso = (d: Date) => d.toISOString();
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const long = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/**
 * The demo persona's inbox (spec §2.5): one email per case, dated relative to `now` so deadlines stay in the future.
 * Classifications are what a correct classifier returns; they are served as classifyEmail's fixture-mode fallback.
 */
export function demoEmails(now = new Date()): { email: RawEmail; classification: Classification }[] {
  const ago = (n: number) => new Date(now.getTime() - n * DAY);
  const ahead = (n: number) => new Date(now.getTime() + n * DAY);
  const testUrl = "https://demo.placed.test/assessment/lendable-numerical";
  const videoUrl = "https://demo.placed.test/video/monzo-first-round";
  const c = (kind: Classification["kind"], company: string | null, extra: Partial<Classification> = {}): Classification =>
    ({ kind, company, roleHint: null, deadline: null, actionUrl: null, confidence: 0.95, ...extra });
  const e = (id: string, sender: string, subject: string, date: Date, text: string): RawEmail =>
    ({ id, from: `${sender} <noreply@demo.placed.test>`, subject, date: iso(date), text });

  const testDue = ahead(2), videoDue = ahead(4);
  return [
    { email: e("demo-01", "Lendable Early Careers", "We've received your application", ago(9),
        "Hi Ayşe, thank you for applying for the Credit Analyst Intern role at Lendable. We'll be in touch about next steps."),
      classification: c("received", "Lendable", { roleHint: "Credit Analyst Intern" }) },
    { email: e("demo-02", "Lendable Early Careers", "Next step: online numerical test", ago(2),
        `Hi Ayşe, the next step for the Credit Analyst Intern role is a 25-minute numerical reasoning test. Please complete it by ${long(testDue)}: ${testUrl}`),
      classification: c("assessment", "Lendable", { roleHint: "Credit Analyst Intern", deadline: ymd(testDue), actionUrl: testUrl }) },
    { email: e("demo-03", "Monzo Talent", "Your recorded video interview", ago(1),
        `Hi Ayşe, please record your first-round video interview for the Data Analyst Intern role by ${long(videoDue)}. Start here: ${videoUrl}`),
      classification: c("assessment", "Monzo", { roleHint: "Data Analyst Intern", deadline: ymd(videoDue), actionUrl: videoUrl }) },
    { email: e("demo-04", "IMC Campus Recruiting", "Invitation to interview", ago(1),
        "Hi Ayşe, we'd like to invite you to a 45-minute interview with our team. Please reply with your availability next week."),
      classification: c("interview", "IMC") },
    { email: e("demo-05", "Palantir Recruiting", "Update on your application", ago(5),
        "Hi Ayşe, thank you for your interest. After careful review we will not be moving you forward to the interview stage this time."),
      classification: c("rejection", "Palantir") },
    { email: e("demo-06", "Jump Trading Campus", "Your offer", ago(0.2),
        "Hi Ayşe, congratulations! We're delighted to offer you a place on our summer internship. Your offer letter is attached."),
      classification: c("offer", "Jump Trading") },
    { email: e("demo-07", "Datadog Talent Community", "New roles you might like", ago(3),
        "Thanks for joining our talent community. Here are this week's open roles across engineering and sales."),
      classification: c("other", null, { confidence: 0.9 }) },
    { email: e("demo-08", "Celonis Early Talent", "Application received", ago(4),
        "Hi Ayşe, thank you for applying to Celonis. Our team will review your application."),
      classification: c("received", "Celonis") },
  ];
}

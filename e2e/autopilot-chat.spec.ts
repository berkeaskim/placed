import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import Database from "better-sqlite3";
import { FIXTURE_COMPANY, FIXTURE_CV, FIXTURE_JD_LINES, FIXTURE_ROLE } from "../tests/cover-letter/fixtures";
import { E2E_DATA_DIR } from "./global-setup";

/**
 * The Autopilot chat end to end, in fixture mode, on two seeded fictional jobs whose forms (autopilot_packs.form) are
 * inserted directly, so no employer page is fetched. Job 1 is answered question by question (chips, composer, a drafted
 * long answer). Job 2 shares the gender question and the long-answer question: the gender answer is remembered (counted as
 * filled, never asked) and the long answer is offered again as "Use my answer from <company>".
 *
 * Fixture: fixtures/ai/autopilotDraft/e2e-ap-1-question_proud.json (cites the bullet ids of tests/cover-letter/fixtures.ts).
 * Only the FICTIONAL persona Ayşe Demir's values are typed into the Vault. Nothing here submits an application.
 */

const USER = "00000000-0000-4000-8000-000000000001";
const PROUD = "Describe a project you are proud of";
const GENDER = "What is your gender?";
const OFFICE = "Which office would you prefer?";
const TEAM = "Which team would you most like to join?";
const RTW = "Are you legally authorised to work in the UK?";
const COMPANY_2 = "Halden Partners";
const GENDER_OPTIONS = ["Woman", "Man", "Non-binary", "Prefer not to say"];

const dbFile = () => path.join(process.env.PLACED_DATA_DIR || E2E_DATA_DIR, "placed.db");
function withDb<T>(fn: (db: Database.Database) => T): T {
  const db = new Database(dbFile());
  try { return fn(db); } finally { db.close(); }
}

/** Alex Morgan's CV becomes the active CV (the draft fixture cites its bullet ids); returns the previous active CV's id. */
function seedCv(): { cvId: string; previous: string | null } {
  return withDb((db) => {
    const prev = db.prepare("select id from cvs where user_id = ? and is_active = 1").get(USER) as { id: string } | undefined;
    db.prepare("update cvs set is_active = 0 where user_id = ?").run(USER);
    const cvId = crypto.randomUUID();
    db.prepare("insert into cvs (id, user_id, storage_path, file_size, page_count, raw_text, parsed_json, is_active, uploaded_at) values (?, ?, ?, 1, 1, '', ?, 1, ?)")
      .run(cvId, USER, `${USER}/e2e-autopilot-chat.pdf`, JSON.stringify(FIXTURE_CV), new Date().toISOString());
    return { cvId, previous: prev?.id ?? null };
  });
}

function restoreCv(s: { cvId: string; previous: string | null }) {
  withDb((db) => {
    db.prepare("delete from cvs where id = ?").run(s.cvId);
    if (s.previous) db.prepare("update cvs set is_active = 1 where id = ?").run(s.previous);
  });
}

type Field = { key: string; label: string; type: string; required: boolean; options: { label: string; value: string }[]; target: string; wordLimit?: number };
const field = (key: string, label: string, type: string, o: Partial<Field> = {}): Field => ({ key, label, type, required: true, options: [], target: `#${key}`, ...o });
const opts = (labels: string[]) => labels.map((label) => ({ label, value: label.toLowerCase().replace(/\W+/g, "-") }));

/** A fictional job with its application form already stored, so the pack never fetches an employer page. */
function seedJob(company: string, extId: string, fields: Field[]): string {
  return withDb((db) => {
    const slug = `e2e-ap-${crypto.randomUUID().slice(0, 8)}`;
    const companyId = db.prepare("insert into companies (slug, name, ats, enabled) values (?, ?, 'greenhouse', 0)").run(slug, company).lastInsertRowid;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare("insert into jobs (id, company_id, ext_id, title, url, location, archetype, text_lines, tag_status, first_seen, last_seen) values (?, ?, ?, ?, ?, 'London', 'quant_trading', ?, 'ok', ?, ?)")
      .run(id, companyId, extId, FIXTURE_ROLE, `https://example.com/${slug}/summer-analyst`, JSON.stringify(FIXTURE_JD_LINES), now, now);
    const form = { ats: "greenhouse", url: `https://example.com/${slug}/apply`, fields };
    db.prepare("insert into autopilot_packs (id, user_id, job_id, form, answers, suggestions, drafts, status, created_at) values (?, ?, ?, ?, '{}', '{}', '{}', 'draft', ?)")
      .run(crypto.randomUUID(), USER, id, JSON.stringify(form), now);
    return id;
  });
}

const identity = () => [field("first_name", "First name", "text"), field("last_name", "Last name", "text"), field("email", "Email", "text")];
const gender = () => field("gender", GENDER, "select", { options: opts(GENDER_OPTIONS) });
const proud = () => field("question_proud", PROUD, "textarea", { wordLimit: 150 });

const chat = (page: Page) => page.getByRole("region", { name: "Autopilot" });
const log = (page: Page) => chat(page).getByRole("log");
const live = (page: Page) => chat(page).locator("[data-autopilot-live]");
const done = (page: Page, label: string) => chat(page).getByRole("list", { name: "Questions" }).getByRole("button", { name: new RegExp(`^${label}.*, answered$`) });

async function startChat(page: Page, jobId: string) {
  await page.goto(`/jobs/${jobId}`);
  await page.getByRole("button", { name: "Autopilot this application" }).click();
  await expect(chat(page)).toBeVisible();
}

test.describe.serial("Autopilot chat", () => {
  let cv: { cvId: string; previous: string | null };
  let job1: string;
  let job2: string;

  test.beforeAll(() => {
    cv = seedCv();
    job1 = seedJob(FIXTURE_COMPANY, "e2e-ap-1", [
      ...identity(),
      field("rtw", RTW, "boolean"),
      field("office", OFFICE, "select", { options: opts(["London", "Manchester", "Edinburgh"]) }),
      field("team", TEAM, "text"),
      gender(),
      proud(),
    ]);
    job2 = seedJob(COMPANY_2, "e2e-ap-2", [...identity(), gender(), proud()]);
  });
  test.afterAll(() => restoreCv(cv));

  test("unlock Autopilot with the fictional persona", async ({ page }) => {
    await page.goto("/autopilot/setup");
    const text: Record<string, string> = {
      first_name: "Ayşe", last_name: "Demir", email: "ayse.demir.demo@example.com", phone: "+44 7700 900123",
      country: "United Kingdom", city: "London", university: "University College London", degree: "BSc Economics",
      grad_year: "2028", start_date: "2027-06-01", heard_about: "Placed",
    };
    for (const [name, value] of Object.entries(text)) {
      const el = page.locator(`#${name}`).first();
      if ((await el.evaluate((n) => n.tagName)) === "SELECT") await el.selectOption(value);
      else await el.fill(value);
    }
    await page.locator("#year_of_study").selectOption("2nd");
    await page.locator("#grad_month").selectOption("June");
    await page.locator("#rtw_uk").selectOption({ index: 1 });
    await page.locator("#needs_sponsorship").selectOption("no");
    await page.getByRole("button", { name: "Save my answers" }).click();
    await expect(page.getByRole("status").filter({ hasText: /Autopilot unlocked/ })).toBeVisible({ timeout: 30_000 });
  });

  test("job 1: answer every question in the chat, draft a long answer, reload, change an answer", async ({ page }) => {
    await startChat(page, job1);

    // Opening summary: the three identity fields come straight from setup
    await expect(log(page).getByText(/I filled \d+ answers/)).toBeVisible();
    await expect(log(page).getByText("I filled 3 answers from your profile and past applications.")).toBeVisible();
    for (const l of ["First name", "Last name", "Email"]) await expect(done(page, l)).toBeVisible();

    // Open & fill waits for the blocking questions (a long answer never blocks it)
    await expect(page.getByRole("button", { name: /Open & fill/ })).toBeDisabled();

    // Right to work is always confirmed (or asked): either way one tap on the first option answers it
    await expect(log(page).getByText(RTW)).toBeVisible();
    await live(page).getByRole("button").first().click();
    await expect(done(page, "Are you legally authorised")).toBeVisible();

    // 3-option select -> chips
    await expect(log(page).getByText(`${OFFICE} *`)).toBeVisible();
    await live(page).getByRole("button", { name: "Manchester" }).click();
    await expect(done(page, "Which office")).toBeVisible();
    await expect(log(page).locator(".msg.me").filter({ hasText: "Manchester" })).toBeVisible();

    // required text -> composer
    const team = page.getByRole("textbox", { name: TEAM });
    await expect(team).toBeEditable();
    await team.fill("Markets");
    await team.press("Enter");
    await expect(done(page, "Which team")).toBeVisible();

    // EEO question is asked on the first job, with a way to decline
    await expect(log(page).getByText(GENDER)).toBeVisible();
    await expect(live(page).getByRole("button", { name: "Prefer not to say" })).toBeVisible();
    await live(page).getByRole("button", { name: "Woman" }).click();
    await expect(done(page, "What is your gender")).toBeVisible();
    await expect(page.getByRole("button", { name: /Open & fill/ })).toBeEnabled();

    // Long answer: the question carries its limit and offers the four ways to answer
    await expect(log(page).getByText(`${PROUD} (up to 150 words)`)).toBeVisible();
    for (const n of ["Write it for me", "Give me ideas", "I'll write it", "Skip, I'll write it on the form"]) await expect(live(page).getByRole("button", { name: n, exact: true })).toBeVisible();
    await expect(live(page).getByRole("button", { name: /Use my answer from/ })).toHaveCount(0);
    await live(page).getByRole("button", { name: "Write it for me" }).click();
    await expect(log(page).getByText(/\d+ \/ 150 words/)).toBeVisible({ timeout: 30_000 });
    await expect(log(page).getByText(/trading desk/).first()).toBeVisible();
    await live(page).getByRole("button", { name: "Use this" }).click();
    await expect(done(page, PROUD)).toBeVisible();
    await expect(log(page).getByText("All answered. You're ready to fill the form.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Open & fill/ })).toBeEnabled();

    // Reload: the answers are back, nothing is pending. Short answers are remembered, so on this reload they count as
    // filled from past applications (office, team, gender); right to work is always re-confirmed and stays in the transcript.
    await page.reload();
    await startChat(page, job1);
    await expect(log(page).getByText("I filled 6 answers from your profile and past applications.")).toBeVisible();
    await expect(log(page).getByText("All answered. You're ready to fill the form.")).toBeVisible();
    await expect(log(page).locator(".msg.me").filter({ hasText: /^Yes$/ })).toBeVisible();
    await expect(log(page).getByText(/I ran the trading desk of a £50k student investment fund/)).toBeVisible();
    for (const l of ["First name", "Are you legally authorised", "Which office", "Which team", "What is your gender", PROUD]) await expect(done(page, l)).toBeVisible();
    await expect(chat(page).getByRole("list", { name: "Questions" }).getByRole("button", { name: /not answered yet$|asking now$/ })).toHaveCount(0);
    await expect(live(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Open & fill/ })).toBeEnabled();

    // Click a ticked row: it is asked again, and a new answer replaces the old one in the transcript and the list
    await done(page, "Are you legally authorised").click();
    await expect(live(page).getByRole("button", { name: "Keep my answer" })).toBeVisible();
    await live(page).getByRole("button", { name: "No", exact: true }).click();
    await expect(log(page).locator(".msg.me").filter({ hasText: /^No$/ })).toBeVisible();
    await expect(log(page).locator(".msg.me").filter({ hasText: /^Yes$/ })).toHaveCount(0);
    await expect(done(page, "Are you legally authorised")).toBeVisible();
    await expect(log(page).getByText("All answered. You're ready to fill the form.")).toBeVisible();
  });

  test("job 2: remembered gender is counted as filled, the long answer is offered again", async ({ page }) => {
    await startChat(page, job2);

    // first, last, email and the remembered gender answer
    await expect(log(page).getByText("I filled 4 answers from your profile and past applications.")).toBeVisible();
    await expect(done(page, "What is your gender")).toBeVisible();
    await expect(log(page).getByText(GENDER)).toHaveCount(0);

    // the long answer is the only question, with the earlier answer as a chip
    await expect(log(page).getByText(`${PROUD} (up to 150 words)`)).toBeVisible();
    const earlier = live(page).getByRole("button", { name: /^Use my answer from / });
    await expect(earlier).toHaveText(`Use my answer from ${FIXTURE_COMPANY}`);
    await earlier.click();
    await expect(log(page).getByText(/I ran the trading desk of a £50k student investment fund/)).toBeVisible();
    await expect(log(page).getByText(/\d+ \/ 150 words/)).toBeVisible();
    await live(page).getByRole("button", { name: "Use this" }).click();
    await expect(done(page, PROUD)).toBeVisible();
    await expect(log(page).getByText("All answered. You're ready to fill the form.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Open & fill/ })).toBeEnabled();
  });
});

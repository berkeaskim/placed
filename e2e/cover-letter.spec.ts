import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import Database from "better-sqlite3";
import { FIXTURE_ANSWERS, FIXTURE_COMPANY, FIXTURE_CV, FIXTURE_FACTS, FIXTURE_JD_LINES, FIXTURE_ROLE } from "../tests/cover-letter/fixtures";
import { trackConsole } from "./fixtures/helpers";
import { E2E_DATA_DIR } from "./global-setup";

/**
 * The Cover Letter Writer end to end, in fixture mode: the fictional Northbridge job and Alex Morgan's CV from
 * tests/cover-letter/fixtures.ts, so the recorded draft (fixtures/ai/coverLetterDraft/default.txt) lines up with the
 * answers typed here. Each step waits for the card's `data-cl-state` and checks that the motion for it really runs.
 *
 * Fixture keys (the job's ext_id): "e2e-cl" holds research back 3.5s and the judge 1.5s, so the researching and
 * checking states last long enough to see; "e2e-cl-fail" makes research fail. With CL_SHOTS_DIR set, a screenshot of each state is saved there.
 */

const USER = "00000000-0000-4000-8000-000000000001";
const SHOTS = process.env.CL_SHOTS_DIR;
const answer = (q: string) => FIXTURE_ANSWERS.find((a) => a.question === q)!.text!;
const TYPED = [answer("why_firm"), answer("story"), answer("touchpoint")];
let shotN = 0;

const dbFile = () => path.join(process.env.PLACED_DATA_DIR || E2E_DATA_DIR, "placed.db");
function withDb<T>(fn: (db: Database.Database) => T): T {
  const db = new Database(dbFile());
  try { return fn(db); } finally { db.close(); }
}

/** Alex Morgan's CV becomes the active CV; returns the previous active CV's id so it can be restored. */
function seedCv(): { cvId: string; previous: string | null } {
  return withDb((db) => {
    const prev = db.prepare("select id from cvs where user_id = ? and is_active = 1").get(USER) as { id: string } | undefined;
    db.prepare("update cvs set is_active = 0 where user_id = ?").run(USER);
    const cvId = crypto.randomUUID();
    db.prepare("insert into cvs (id, user_id, storage_path, file_size, page_count, raw_text, parsed_json, is_active, uploaded_at) values (?, ?, ?, 1, 1, '', ?, 1, ?)")
      .run(cvId, USER, `${USER}/e2e-cover-letter.pdf`, JSON.stringify(FIXTURE_CV), new Date().toISOString());
    return { cvId, previous: prev?.id ?? null };
  });
}

function restoreCv(s: { cvId: string; previous: string | null }) {
  withDb((db) => {
    db.prepare("delete from cvs where id = ?").run(s.cvId);
    if (s.previous) db.prepare("update cvs set is_active = 1 where id = ?").run(s.previous);
  });
}

/** A fresh Northbridge job on its own (disabled, never ingested) company row. Research for the firm starts uncached. */
function seedJob(extId: string): string {
  return withDb((db) => {
    db.prepare("delete from company_research where company_key like ?").run(`${FIXTURE_COMPANY.toLowerCase()}|%`);
    const slug = `e2e-northbridge-${crypto.randomUUID().slice(0, 8)}`;
    const companyId = db.prepare("insert into companies (slug, name, ats, enabled) values (?, ?, 'greenhouse', 0)").run(slug, FIXTURE_COMPANY).lastInsertRowid;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare("insert into jobs (id, company_id, ext_id, title, url, location, archetype, text_lines, tag_status, first_seen, last_seen) values (?, ?, ?, ?, ?, 'London', 'quant_trading', ?, 'ok', ?, ?)")
      .run(id, companyId, extId, FIXTURE_ROLE, "https://example.com/northbridge/summer-analyst", JSON.stringify(FIXTURE_JD_LINES), now, now);
    return id;
  });
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${String(++shotN).padStart(2, "0")}-${name}.png`) });
}

const card = (page: Page) => page.locator("section.cl");
const state = (page: Page, s: string) => page.locator(`section.cl[data-cl-state="${s}"]`);
const paperText = (page: Page) => page.locator(".cl .paper").innerText();
const words = async (page: Page) => Number(await page.locator(".cl [data-cl-words]").getAttribute("data-cl-words"));
/** Every state the card has been in, in order (recorded by the init script below). */
const states = (page: Page) => page.evaluate(() => (window as unknown as { __clStates: string[] }).__clStates);

/** Animations still running whose keyframes are named like `pattern` (cl-breathe, cl-spin, cl-sh, ...). */
const running = (page: Page, pattern: string) => page.evaluate((p) => document.getAnimations()
  .filter((a) => a.playState === "running" && new RegExp(p).test((a as CSSAnimation).animationName ?? ""))
  .map((a) => (a as CSSAnimation).animationName), pattern);

async function recordStates(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __clStates: string[] };
    w.__clStates = [];
    const read = () => {
      const s = document.querySelector("[data-cl-state]")?.getAttribute("data-cl-state");
      if (s && w.__clStates.at(-1) !== s) w.__clStates.push(s);
    };
    new MutationObserver(read).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-cl-state"] });
  });
}

/** Types into the composer, whose label is the bot's current question. */
async function reply(page: Page, question: RegExp, text: string) {
  const input = page.getByRole("textbox", { name: question });
  await expect(input).toBeEditable();
  await input.fill(text);
  await input.press("Enter");
}

/** Nothing left mid-motion: no rewriting paragraph, typing dots or spinning research ring. */
async function expectSettled(page: Page) {
  await expect.poll(() => page.evaluate(() => document.querySelectorAll(".editing, .typing, .research:not(.done) .orb").length)).toBe(0);
}

/** Steps 1–6: open, answer, research, pick 2 facts, answer, and let the letter write itself. */
async function interviewAndDraft(page: Page, jobId: string, o: { reduced: boolean }) {
  await page.goto(`/jobs/${jobId}`);
  await page.getByRole("button", { name: "Write cover letter" }).click();
  await expect(card(page)).toBeVisible();

  // asking: the first question
  await expect(state(page, "asking")).toBeVisible();
  await expect(page.locator(".cl .msg.bot").first()).toBeVisible();
  await shot(page, o.reduced ? "reduced-asking" : "asking");
  await reply(page, /^Why Northbridge Capital/, answer("why_firm"));
  await expect(page.locator(".cl .msg.me").first()).toHaveText(answer("why_firm"));

  // researching: the ring spins (or, under reduced motion, stands still) while the facts are found
  await expect(state(page, "researching")).toBeVisible();
  await expect(page.locator(".cl .research .orb")).toBeVisible();
  await expect(page.locator(".cl .research")).not.toHaveClass(/\bdone\b/);
  if (o.reduced) expect(await running(page, "breathe|spin|sh")).toEqual([]);
  else expect(await running(page, "cl-spin")).not.toEqual([]);
  await shot(page, o.reduced ? "reduced-researching" : "researching");

  // picking: tick two facts
  await expect(state(page, "picking")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".cl .research.done")).toBeVisible();
  const facts = page.locator(".cl .fact");
  await expect(facts).toHaveCount(FIXTURE_FACTS.length);
  await facts.nth(0).click();
  await facts.nth(1).click();
  await expect(page.locator(".cl .fact.on")).toHaveCount(2);
  await shot(page, o.reduced ? "reduced-picking" : "picking");
  await page.getByRole("button", { name: "Use these 2" }).click();

  // asking: the story, then the touchpoint
  await expect(state(page, "asking")).toBeVisible();
  await reply(page, /^Your CV mentions/, answer("story"));
  await expect(state(page, "asking")).toBeVisible();
  await reply(page, /^Have you met anyone/, answer("touchpoint"));

  // drafting: words stream in behind a caret
  await expect(state(page, "drafting")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".cl .paper .caret")).toBeVisible();
  if (!o.reduced) {
    const counts: number[] = [];
    for (let i = 0; i < 3; i++) {
      counts.push(await page.locator(".cl .paper .w").count());
      if (i < 2) await page.waitForTimeout(200);
    }
    expect(counts[1], `.w counts ${counts}`).toBeGreaterThan(counts[0]);
    expect(counts[2], `.w counts ${counts}`).toBeGreaterThan(counts[1]);
  } else {
    await expect(page.locator(".cl .paper .w").first()).toBeAttached();
    expect(await page.locator(".cl .paper .w").first().evaluate((el) => getComputedStyle(el).filter)).toBe("none");
    expect(await running(page, "breathe|spin|sh")).toEqual([]);
  }
  await shot(page, o.reduced ? "reduced-drafting" : "drafting");

  // checking (the scan line runs over the letter) → done (chips)
  await expect(state(page, "checking")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".cl .scan.go")).toBeAttached();
  if (!o.reduced) expect(await running(page, "cl-scan")).not.toEqual([]);
  await shot(page, o.reduced ? "reduced-checking" : "checking");
  await expect(state(page, "done")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".cl .chip").first()).toBeVisible();
  const seen = await states(page);
  const order = ["asking", "researching", "picking", "thinking", "drafting", "checking", "done"];
  const at = order.map((s) => seen.indexOf(s));
  expect(at.every((i, k) => i >= 0 && (k === 0 || i > at[k - 1])), `state order: ${seen.join(" → ")}`).toBe(true);
  await shot(page, o.reduced ? "reduced-done" : "done");
}

test.describe("cover letter writer", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  let cv: { cvId: string; previous: string | null };
  test.beforeAll(() => { cv = seedCv(); });
  test.afterAll(() => restoreCv(cv));
  test.beforeEach(async ({ page }) => { await recordStates(page); });
  test.afterEach(async ({ page }) => { await expectSettled(page); });

  test("full flow: interview, research, streaming, checking, edit, undo, confirm, Ready and PDF", async ({ page }) => {
    test.setTimeout(180_000);
    const errors = trackConsole(page);
    const jobId = seedJob("e2e-cl");
    await interviewAndDraft(page, jobId, { reduced: false });

    // 7. the student's own spans are verbatim
    const theirs = await page.locator(".cl .paper [data-span=theirs]").allInnerTexts();
    expect(theirs.length).toBeGreaterThan(0);
    for (const t of theirs) expect(TYPED, `theirs span: ${t}`).toContain(t.trim());

    // 8. edit: "Make the opening shorter" (typed, so it targets the opening; the "Make it shorter" chip picks the
    // paragraph with the most AI text, which the recorded opening-paragraph fixture does not fit). The paragraph
    // breathes, its words dissolve and the new ones stream in; the word count changes.
    await expect(page.getByRole("group", { name: "Quick edits" }).getByRole("button", { name: "Make it shorter" })).toBeVisible();
    const before = await paperText(page);
    const wordsBefore = await words(page);
    await reply(page, /^Message$/, "Make the opening shorter");
    await expect(state(page, "editing")).toBeVisible();
    await expect(page.locator(".cl .paper p.editing")).toBeVisible();
    await shot(page, "editing");
    await expect(state(page, "done")).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => words(page)).not.toBe(wordsBefore);
    await expect(page.locator(".cl .editing")).toHaveCount(0);
    await shot(page, "edited");

    // 9. Undo puts the previous text back
    await page.locator(".cl .msg.bot").filter({ hasText: /^Done: \d+ → \d+ words\./ }).getByRole("button", { name: "Undo" }).click();
    await expect.poll(() => paperText(page), { timeout: 15_000 }).toBe(before);
    await expect(state(page, "done")).toBeVisible();
    await expect.poll(() => words(page)).toBe(wordsBefore);
    await expectSettled(page);

    // 10. each flagged claim: "This is true" → Mark ready → the PDF downloads
    const flags = page.locator(".cl .paper [data-span=ai][data-flag]");
    const ready = page.getByRole("button", { name: "Mark ready" });
    const pop = page.getByRole("dialog", { name: "Something to check" });
    await expect(flags.first()).toBeVisible();
    await expect(ready).toBeDisabled();
    // In the editable letter a click on amber text only places the caret, and leaving without typing saves nothing.
    const flagCount = await flags.count();
    await flags.first().click();
    await expect(pop).toHaveCount(0);
    await page.locator(".cl .lint").click();
    await expect(state(page, "done")).toBeVisible();
    await expect(flags).toHaveCount(flagCount);
    // The check opens from its own "?" control, by keyboard too.
    await page.locator(".cl .paper .flag-q").first().focus();
    await page.keyboard.press("Enter");
    await expect(pop.getByRole("button", { name: "Edit" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(pop).toHaveCount(0);
    for (let n = await flags.count(), first = true; n > 0; n--, first = false) {
      await page.locator(".cl .paper .flag-q").first().click();
      await expect(pop.getByRole("button", { name: "Edit" })).toBeVisible();
      if (first) await shot(page, "flag-check");
      await pop.getByRole("button", { name: "This is true" }).click();
      // the inline own-words step: skip it, so the claim stays in this letter only
      await pop.getByRole("button", { name: "Just this letter" }).click();
      await expect(flags).toHaveCount(n - 1);
    }
    await expect(ready).toBeEnabled();
    await ready.click();
    const pdf = page.getByRole("link", { name: "Download PDF" });
    await expect(pdf).toBeVisible();
    const res = await page.request.get((await pdf.getAttribute("href"))!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/pdf");
    expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");
    await shot(page, "ready");

    // the stacked layout (below 900px)
    await page.setViewportSize({ width: 390, height: 844 });
    await card(page).scrollIntoViewIfNeeded();
    await shot(page, "stacked-390");
    await page.setViewportSize({ width: 1440, height: 900 });
    expect(errors).toEqual([]);
  });

  test("research failure: Retry is offered, nothing spins, and the letter is still written", async ({ page }) => {
    test.setTimeout(120_000);
    const jobId = seedJob("e2e-cl-fail");
    await page.goto(`/jobs/${jobId}`);
    await page.getByRole("button", { name: "Write cover letter" }).click();
    await expect(state(page, "asking")).toBeVisible();
    await reply(page, /^Why Northbridge Capital/, answer("why_firm"));

    const notes = page.locator(".cl .msg.bot").filter({ hasText: /didn't work this time/ });
    await expect(notes).toHaveCount(1, { timeout: 15_000 });
    const retry = page.locator(".cl").getByRole("button", { name: "Retry" });
    await expect(retry).toBeEnabled();
    await expect(page.getByRole("textbox", { name: /^Your CV mentions/ })).toBeEditable();
    await shot(page, "research-failed");
    // Retry runs the lookup again; the fixture fails again, so a second note comes back with its own Retry.
    await retry.click();
    await expect(notes).toHaveCount(2, { timeout: 15_000 });
    await expect(retry).toHaveCount(1);
    await page.waitForTimeout(3000);
    expect(await page.evaluate(() => document.querySelectorAll(".research:not(.done):not(.stopped) .orb").length)).toBe(0);
    expect(await running(page, "cl-spin")).toEqual([]);

    await reply(page, /^Your CV mentions/, answer("story"));
    await reply(page, /^Have you met anyone/, answer("touchpoint"));
    await expect(state(page, "drafting")).toBeVisible({ timeout: 30_000 });
    await expect(state(page, "done")).toBeVisible({ timeout: 30_000 });
    expect(await words(page)).toBeGreaterThan(100);
    await shot(page, "research-failed-done");
  });

  test("reduced motion: the same flow with cross-fades only (no blur, spin, shimmer or breathing)", async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const jobId = seedJob("e2e-cl");
    await interviewAndDraft(page, jobId, { reduced: true });
    expect(await running(page, "breathe|spin|sh")).toEqual([]);
  });
});

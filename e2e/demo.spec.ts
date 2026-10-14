import path from "node:path";
import { test, expect } from "@playwright/test";
import { hasDemoCreds, trackConsole } from "./fixtures/helpers";

/**
 * The 3-minute demo (spec §12, amendments Task 25 demo order) as one run, signed in through the real
 * "Try the demo" button as the FICTIONAL persona Ayşe Demir, in fixture mode.
 *
 * Preconditions (the human runs these; see docs/demo/REHEARSAL.md):
 *   npm run demo:user && npm run demo:reset     (demo account exists and is NOT onboarded)
 *   the dev server runs with NEXT_PUBLIC_DEMO_MODE=1 and AI_MODE=fixture (playwright.config.ts sets both when it starts it)
 * Selectors follow the rendered UI: onboarding (app/onboarding/page.tsx), upload (profile/build/upload-card.tsx),
 * score panel (components/cv-score-panel.tsx), feed card (components/job-card.tsx), tailor panel
 * (jobs/[id]/tailor-panel.tsx + components/tailor/*), apply (jobs/[id]/apply-button.tsx).
 */
test.skip(!hasDemoCreds, "DEMO_EMAIL/DEMO_PASSWORD not set: run npm run demo:user first");

const DEMO_CV = path.join(process.cwd(), "seed", "demo", "ayse-demir-cv.pdf");
const DEMO_JOB = "Credit Analyst Intern (June 2027)"; // Lendable, ext_id a2214edc-… (lib/demo/fixture-keys.ts)

test("3-minute demo flow", async ({ page, context }) => {
  test.setTimeout(240_000);
  const errors = trackConsole(page);

  // 1. Demo sign-in → onboarding (tap-only)
  await page.goto("/login");
  await page.getByRole("button", { name: "Try the demo as Ayşe (fictional student)" }).click();
  await page.waitForURL(/\/onboarding$/, { timeout: 30_000 });
  await page.getByRole("button", { name: "2nd year" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Economics" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "London" }).click();
  await page.getByRole("button", { name: "Let's go" }).click();
  await page.waitForURL(/\/profile\/build$/, { timeout: 30_000 });

  // 2. Upload the fictional CV → profile with the CV Score and cited fixes
  await page.locator('input[name="cv"]').setInputFiles(DEMO_CV);
  await page.waitForURL(/\/profile(\?.*)?$/, { timeout: 60_000 });
  await expect(page.getByRole("img", { name: /CV score \d+ out of 100 for Data & Analytics/ })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/^Source: /).first()).toBeVisible();
  await expect(page.getByText("Organised weekly society events", { exact: false }).first()).toBeVisible();

  // 3. Sector switch: rescored for Consulting, where the events bullet is the next best fix
  await page.getByLabel("Score my CV for").selectOption("consulting");
  await expect(page.getByRole("img", { name: /CV score \d+ out of 100 for Consulting/ })).toBeVisible({ timeout: 60_000 });
  const nextFix = page.locator("section", { has: page.getByRole("heading", { name: "Next best fix" }) });
  await expect(nextFix.getByText("Organised weekly society events")).toBeVisible();
  await expect(nextFix.getByText(/\[add your real number\]/)).toBeVisible();

  // 4. Feed → the demo job
  await page.getByRole("link", { name: "See my internships" }).click();
  await page.waitForURL(/\/feed/);
  await expect(page.getByRole("article").first()).toBeVisible();
  await page.getByRole("article").filter({ hasText: DEMO_JOB }).first().getByRole("link", { name: "View", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: DEMO_JOB })).toBeVisible();

  // 5. Tailor: the requirement she lacks stays ❌, the gate catches the invented 20% and the AWS→Azure swap
  await page.getByRole("button", { name: "Tailor my CV for this role" }).click();
  await expect(page.getByRole("heading", { name: "What we tailored for, and why" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Not in your CV — we didn't invent it").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /Caught it: 2 lines your CV doesn't support/ })).toBeVisible();
  await expect(page.getByText("Ran the collection script weekly on Azure")).toBeVisible();
  await expect(page.getByText("Every claim traced to your original CV")).toBeVisible();
  await expect(page.getByText("From your original CV").first()).toBeVisible();

  // 6. Confirm this number (+XP): the blank the AI left instead of guessing
  await page.getByRole("button", { name: "Confirm this number", exact: true }).click();
  await expect(page.getByRole("heading", { name: "What's the real number?" })).toBeVisible();
  await page.getByLabel("The real figure").fill("40");
  await page.getByRole("button", { name: "It's accurate, add it" }).click();
  await expect(page.getByText("Organised weekly society events for 40 members").first()).toBeVisible();

  // 7. Apply on the company's own site → "Did you apply?" → First Shot badge
  const [popup] = await Promise.all([
    context.waitForEvent("page"),
    page.getByRole("link", { name: /Apply on company site/ }).click(),
  ]);
  await popup.close();
  await page.bringToFront();
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.getByRole("heading", { name: "Did you apply?" })).toBeVisible();
  await page.getByRole("button", { name: "Yes, I applied" }).click();
  await expect(page.getByText("Badge unlocked: First Shot")).toBeVisible({ timeout: 15_000 });

  expect(errors).toEqual([]);
});

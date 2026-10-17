import { test, expect } from "@playwright/test";
import path from "node:path";
import Database from "better-sqlite3";
import { trackConsole, basicA11y } from "./fixtures/helpers";
import { E2E_DATA_DIR } from "./global-setup";

function alreadyOnboardedXp() {
  const sqlite = new Database(path.join(process.env.PLACED_DATA_DIR || E2E_DATA_DIR, "placed.db"), { readonly: true });
  try {
    return Boolean(sqlite.prepare("select 1 from xp_events where type = 'onboarding_complete'").get());
  } finally {
    sqlite.close();
  }
}

test("landing sends a fresh install straight to onboarding (no login)", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/(onboarding|feed)$/);
});

test("onboarding: school and course search, then tap-only steps, saves and routes to profile/build, XP toast on first completion", async ({ page }) => {
  const errors = trackConsole(page);
  const repeat = alreadyOnboardedXp();
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/onboarding$/);
  const next = page.getByRole("button", { name: "Next", exact: true });

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Where do you study?");
  await expect(next).toBeDisabled();
  const school = page.getByRole("combobox", { name: "Your university" });
  await school.fill("ucl");
  await page.getByRole("option", { name: "University College London" }).click();
  await expect(school).toHaveValue("University College London");
  await next.click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("What do you study?");
  await expect(next).toBeDisabled();
  const course = page.getByRole("combobox", { name: "Your course" });
  await course.fill("econ and stat");
  await course.press("ArrowDown");
  await course.press("Enter");
  await expect(course).toHaveValue("Economics and Statistics");
  await expect(page.getByText("Placed will read this as Economics.")).toBeVisible();
  await next.click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("What year are you in?");
  await expect(next).toBeDisabled();
  await page.getByRole("button", { name: "Penultimate" }).click();
  await expect(page.getByRole("button", { name: "Penultimate" })).toHaveAttribute("aria-pressed", "true");
  await next.click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Where do you want to work?");
  const go = page.getByRole("button", { name: "Let's go" });
  await expect(go).toBeDisabled();
  await page.getByRole("button", { name: "London" }).click();
  await page.getByRole("button", { name: "Remote" }).click();
  await page.getByRole("button", { name: "Remote" }).click(); // toggle off again
  await expect(page.getByRole("button", { name: "Remote" })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("switch").click();
  await expect(page.getByRole("switch")).toBeChecked();

  // Back keeps prior answers
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("button", { name: "Penultimate" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await go.click();
  await expect(page).toHaveURL(/\/profile\/build$/, { timeout: 30_000 });
  const toast = page.locator("[data-sonner-toast]").filter({ hasText: "XP" });
  if (!repeat) {
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/\+\d+ XP/);
  } else {
    // Idempotent: second completion awards 0 XP, so no toast.
    await page.waitForTimeout(1500);
    await expect(toast).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test("a11y: onboarding steps", async ({ page }) => {
  await page.goto("/onboarding");
  expect(await basicA11y(page)).toEqual([]);
  await page.getByRole("combobox", { name: "Your university" }).fill("Univ");
  expect(await basicA11y(page)).toEqual([]); // with the suggestion list open
  await page.getByRole("combobox", { name: "Your university" }).fill("Sorbonne Université");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("combobox", { name: "Your course" }).fill("Law (LLB)");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "1st year" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  expect(await basicA11y(page)).toEqual([]);
});

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { AUTH_FILE, hasE2eCreds, trackConsole, basicA11y } from "./fixtures/helpers";

test.use({ storageState: AUTH_FILE });
test.skip(!hasE2eCreds, "E2E_USER_EMAIL/E2E_USER_PASSWORD not set");

async function alreadyOnboardedXp() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data } = await sb.auth.signInWithPassword({ email: process.env.E2E_USER_EMAIL!, password: process.env.E2E_USER_PASSWORD! });
  const { count } = await sb.from("xp_events").select("id", { count: "exact", head: true })
    .eq("user_id", data.user!.id).eq("type", "onboarding_complete");
  return (count ?? 0) > 0;
}

test("onboarding: tap-only flow saves and routes to profile/build, XP toast on first completion", async ({ page }) => {
  const errors = trackConsole(page);
  const repeat = await alreadyOnboardedXp();
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/onboarding$/);
  const next = page.getByRole("button", { name: "Next", exact: true });

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("What year are you in?");
  await expect(next).toBeDisabled();
  await page.getByRole("button", { name: "Penultimate" }).click();
  await expect(page.getByRole("button", { name: "Penultimate" })).toHaveAttribute("aria-pressed", "true");
  await next.click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("What do you study?");
  await expect(next).toBeDisabled();
  await page.getByRole("button", { name: "Economics" }).click();
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
  await expect(page.getByRole("button", { name: "Economics" })).toHaveAttribute("aria-pressed", "true");
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
  await page.getByRole("button", { name: "1st year" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Law" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  expect(await basicA11y(page)).toEqual([]);
});

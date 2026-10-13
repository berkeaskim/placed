import { test, expect } from "@playwright/test";
import { trackConsole, basicA11y } from "./fixtures/helpers";

test.describe("public pages (logged out)", () => {
  test("landing renders without console errors and links to login", async ({ page }) => {
    const errors = trackConsole(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("placed");
    await expect(page).toHaveTitle(/Placed/);
    await page.getByRole("link", { name: "Get started" }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(errors).toEqual([]);
  });

  test("login page renders magic-link + Google options without console errors", async ({ page }) => {
    const errors = trackConsole(page);
    await page.goto("/login");
    await expect(page.getByText("Welcome to Placed")).toBeVisible();
    await expect(page.getByRole("button", { name: "Email me a magic link" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
    // No password login exists in the UI (actions.ts only has OTP + OAuth); auth for
    // logged-in specs is done in global-setup via signInWithPassword.
    await expect(page.locator("input[type=password]")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("login blocks an invalid email client-side (no request sent)", async ({ page }) => {
    await page.goto("/login");
    const email = page.locator("input[name=email]");
    await email.fill("not-an-email");
    let posted = false;
    page.on("request", (r) => { if (r.method() === "POST") posted = true; });
    await page.getByRole("button", { name: "Email me a magic link" }).click();
    expect(await email.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
    await page.waitForTimeout(500);
    expect(posted).toBe(false);
  });

  for (const route of ["/onboarding", "/profile/build", "/profile", "/feed", "/jobs", "/tracker", "/settings"]) {
    test(`proxy redirects logged-out ${route} -> /login`, async ({ page }) => {
      const res = await page.goto(route);
      await expect(page).toHaveURL(/\/login$/);
      expect(res?.status()).toBe(200);
    });
  }

  test("public routes are not redirected", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("auth callback without code bounces to /login", async ({ page }) => {
    await page.goto("/auth/callback");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("a11y: landing", async ({ page }) => {
    await page.goto("/");
    expect(await basicA11y(page)).toEqual([]);
  });

  // BUG: app/login/page.tsx:46 — email <Input> has only a placeholder, no <label>/aria-label;
  // and the page has no <h1> (CardTitle at app/login/page.tsx:25 renders a <div>).
  test.fail("a11y: login", async ({ page }) => {
    await page.goto("/login");
    expect(await basicA11y(page)).toEqual([]);
  });
});

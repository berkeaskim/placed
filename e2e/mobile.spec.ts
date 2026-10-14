import { test, expect } from "@playwright/test";
import { AUTH_FILE, hasDemoCreds, expectNoHorizontalScroll } from "./fixtures/helpers";

test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

for (const route of ["/", "/login"]) {
  test(`375px: no horizontal scroll on ${route}`, async ({ page }, info) => {
    await page.goto(route);
    await page.screenshot({ path: info.outputPath("mobile.png"), fullPage: true });
    await expectNoHorizontalScroll(page);
  });
}

test.describe("logged in", () => {
  test.use({ storageState: AUTH_FILE });
  test.skip(!hasDemoCreds, "no demo creds");
  for (const route of ["/onboarding", "/profile/build", "/feed"]) {
    test(`375px: no horizontal scroll on ${route}`, async ({ page }, info) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: info.outputPath("mobile.png"), fullPage: true });
      await expectNoHorizontalScroll(page);
    });
  }

  for (const height of [812, 667]) {
    test(`375x${height}: CV dropzone is fully on the first screen`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height });
      await page.goto("/profile/build");
      const drop = page.locator("label").filter({ has: page.locator("input[name=cv]") });
      await expect(drop).toBeInViewport({ ratio: 1 });
    });
  }
});

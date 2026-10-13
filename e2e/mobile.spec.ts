import { test } from "@playwright/test";
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
  for (const route of ["/onboarding", "/profile/build"]) {
    test(`375px: no horizontal scroll on ${route}`, async ({ page }, info) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: info.outputPath("mobile.png"), fullPage: true });
      await expectNoHorizontalScroll(page);
    });
  }
});

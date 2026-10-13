import { test, expect } from "@playwright/test";
import { AUTH_FILE, GEN, hasDemoCreds, trackConsole, basicA11y } from "./fixtures/helpers";

test.use({ storageState: AUTH_FILE });
test.skip(!hasDemoCreds, "DEMO_EMAIL/DEMO_PASSWORD not set");

const cvInput = (page: import("@playwright/test").Page) => page.locator("input[name=cv]");

test("profile/build renders upload + quiz cards", async ({ page }) => {
  const errors = trackConsole(page);
  await page.goto("/profile/build");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Let's find your roles");
  await expect(page.getByRole("heading", { name: "Upload your CV" })).toBeVisible();
  await expect(cvInput(page)).toHaveAttribute("accept", "application/pdf");
  expect(errors).toEqual([]);
});

test("non-PDF file shows a clear error", async ({ page }) => {
  await page.goto("/profile/build");
  await cvInput(page).setInputFiles(GEN("not-a-pdf.txt"));
  await expect(page.getByRole("alert")).toHaveText("Please upload a PDF.");
});

test("fake .pdf (wrong magic bytes) shows a clear error", async ({ page }) => {
  await page.goto("/profile/build");
  await cvInput(page).setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: Buffer.from("Hello, I am definitely a PDF.\n") });
  await expect(page.getByRole("alert")).toContainText("doesn't look like a PDF");
});

test("file over 5 MB is rejected", async ({ page }) => {
  await page.goto("/profile/build");
  const big = Buffer.alloc(5 * 1024 * 1024 + 10, 0x20);
  big.write("%PDF-1.4\n");
  await cvInput(page).setInputFiles({ name: "big.pdf", mimeType: "application/pdf", buffer: big });
  await expect(page.getByRole("alert")).toContainText(/over 5 MB/);
});

test("image-only PDF shows the unreadable-CV guidance", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/profile/build");
  await cvInput(page).setInputFiles(GEN("image-only-cv.pdf"));
  await expect(page.getByRole("status").filter({ hasText: /Reading your CV|Spotting|Finding|Scoring/ })).toBeVisible();
  await expect(page.getByText("We couldn't read this CV")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByRole("link", { name: "Take the quiz" })).toBeVisible();
});

// BUG: app/(app)/profile/build/upload-card.tsx:31 router.push("/profile") — no app/(app)/profile/page.tsx
// exists (`next build` route table has only /profile/build), so a successful upload lands on a 404.
test.fail("realistic CV PDF parses live and lands on the profile page", async ({ page }) => {
  test.setTimeout(150_000);
  const errors = trackConsole(page);
  await page.goto("/profile/build");
  await cvInput(page).setInputFiles(GEN("realistic-cv.pdf"));
  await expect(page.getByRole("status").filter({ hasText: /Reading your CV/ })).toBeVisible();
  await expect(page).toHaveURL(/\/profile$/, { timeout: 120_000 });
  await expect(page.getByText(/could not be found|404/i)).toHaveCount(0);
  expect(errors.filter((e) => !/404/.test(e))).toEqual([]);
});

test("a11y: profile/build", async ({ page }) => {
  await page.goto("/profile/build");
  expect(await basicA11y(page)).toEqual([]);
});

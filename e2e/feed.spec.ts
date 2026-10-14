import { test, expect } from "@playwright/test";
import { AUTH_FILE, hasDemoCreds } from "./fixtures/helpers";

test.use({ storageState: AUTH_FILE });
test.skip(!hasDemoCreds, "DEMO_EMAIL/DEMO_PASSWORD not set");

/** innerText lines of a job's header: avatar initial, company name, then the title. */
const lines = async (loc: import("@playwright/test").Locator) => (await loc.innerText()).split("\n").map((l) => l.trim()).filter(Boolean);

test("every feed card names the company above the title, and the job page repeats it", async ({ page }) => {
  await page.goto("/feed");
  const cards = page.getByRole("article");
  await expect(cards.first()).toBeVisible();
  for (const card of (await cards.all()).slice(0, 10)) {
    const [initial, company, title] = await lines(card);
    expect(company.length).toBeGreaterThan(0);
    expect(initial).toBe(company.match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase() ?? "?");
    await expect(card.getByRole("link").first()).toHaveText(title);
  }

  const first = cards.first();
  const [, company, title] = await lines(first);
  await first.getByRole("link", { name: "View", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  const [, pageCompany, pageTitle] = await lines(page.getByRole("article").first());
  expect(pageCompany).toBe(company);
  expect(pageTitle).toBe(title);
});

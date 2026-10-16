import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { LIVE_DEMO_SKIP, liveDemoSpecsAllowed } from "./fixtures/helpers";

// The fixture inbox only exists for the demo account (lib/demo/is-demo.ts), and demo:tracker wipes its tracker, so this
// spec writes to the LIVE demo: opt-in only. Requires migration 0013 and AI_MODE=fixture.
test.skip(!liveDemoSpecsAllowed, LIVE_DEMO_SKIP);

test.beforeAll(() => {
  execSync("npm run demo:tracker", { stdio: "pipe", timeout: 60_000 }); // inherits PLACED_ALLOW_LIVE_DEMO_WRITE
});

// Signs in through the "Try the demo" button: the shared storageState is the e2e user, not the demo account.
test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Try the demo as Ayşe/ }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
});

test("demo inbox sync moves cards with evidence, the nudge opens the drafter, undo works", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/tracker");
  const inbox = page.getByRole("region", { name: "Inbox" });
  await inbox.getByRole("button", { name: "Sync inbox" }).click();
  await expect(inbox.getByRole("status")).toContainText("Checked 8 emails");

  const interview = page.getByRole("region", { name: "Interview" });
  await expect(interview).toContainText("IMC");
  await expect(page.getByRole("region", { name: "Offer" })).toContainText("Jump");
  await expect(page.getByRole("region", { name: "Rejected" })).toContainText("Palantir");
  await expect(page.getByText(/Assessment: (\d+ days? left|due today)/).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Emails to review" })).toContainText("Celonis");

  // the interview nudge, before Undo takes IMC out of Interview
  await interview.getByRole("link", { name: /Interview at IMC/ }).click();
  const people = page.getByRole("region", { name: "People to reach" });
  await expect(people).toBeVisible();
  await people.getByRole("button", { name: "Write it" }).click();
  await expect(people.getByText(/Connection note \(\d+\/300\)/)).toBeVisible();

  await page.goto("/tracker");
  await page.getByRole("region", { name: "Interview" }).getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("region", { name: "Applied" })).toContainText("IMC");

  await page.getByRole("region", { name: "Inbox" }).getByRole("button", { name: "Sync inbox" }).click();
  await expect(page.getByRole("region", { name: "Inbox" }).getByRole("status")).toContainText("0 cards moved");

  // a review row can be dismissed without touching any card
  await page.getByRole("region", { name: "Emails to review" }).getByRole("button", { name: "Dismiss" }).first().click();
  await expect(page.getByText("Celonis")).toHaveCount(0);
});

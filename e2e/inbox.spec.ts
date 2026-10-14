import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { AUTH_FILE, hasDemoCreds } from "./fixtures/helpers";

// Requires: migration 0013 applied, AI_MODE=fixture, demo user signed in via global-setup (storageState).
test.skip(!hasDemoCreds, "DEMO_EMAIL/DEMO_PASSWORD not set: run npm run demo:user first");
test.use({ storageState: AUTH_FILE });

// Self-contained: resets only the demo user's applications/inbox_events/outreach to the plan state.
test.beforeAll(() => {
  execSync("npm run demo:tracker", { stdio: "pipe", timeout: 60_000 });
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

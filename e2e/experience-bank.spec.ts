import { test, expect } from "@playwright/test";
import path from "node:path";
import Database from "better-sqlite3";
import { getDocumentProxy } from "unpdf";
import { GEN, trackConsole } from "./fixtures/helpers";
import { E2E_DATA_DIR } from "./global-setup";

// Celonis "AI & Management Consulting Intern": a seeded data job with no recorded tailorCV fixture, so fixture mode
// falls back to reorder-only. Looked up by its ext_id because the page URL uses the generated row id.
const JOB_EXT_ID = "7986192003";
const PROJECT_TITLE = "Churn Forecasting Pipeline";
const PROJECT_ORG = "Personal Project";

function jobIdFor(extId: string): string {
  const sqlite = new Database(path.join(process.env.PLACED_DATA_DIR || E2E_DATA_DIR, "placed.db"), { readonly: true });
  try {
    const row = sqlite.prepare("select id from jobs where ext_id = ?").get(extId) as { id: string } | undefined;
    if (!row) throw new Error(`seeded job ${extId} not found`);
    return row.id;
  } finally {
    sqlite.close();
  }
}

test.describe.configure({ mode: "serial" });

test("experience bank: bootstrap from CV, add a project, tailor, remove and add back, one-page PDF", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackConsole(page);
  const jobId = jobIdFor(JOB_EXT_ID);

  // 1. Upload a CV.
  await page.goto("/profile/build");
  await page.locator("input[name=cv]").setInputFiles(GEN("realistic-cv.pdf"));
  await expect(page).toHaveURL(/\/profile$/, { timeout: 120_000 });

  // 2. The first visit bootstraps the bank from the CV.
  await page.goto("/profile/bank");
  await expect(page.getByText("We filled this from your CV. Add more from LinkedIn or your old CVs.")).toBeVisible();

  // 3. Add a manual project with two bullets that mention Python and SQL and a number.
  await page.getByRole("button", { name: "Add an entry" }).click();
  await page.getByLabel("Section").selectOption("projects");
  await page.getByLabel("Organisation").fill(PROJECT_ORG);
  await page.getByLabel("Title").fill(PROJECT_TITLE);
  await page.getByLabel("Dates").fill("Jan 2026 - Mar 2026");
  await page.getByRole("button", { name: "Add entry", exact: true }).click();
  const entry = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: `${PROJECT_TITLE} · ${PROJECT_ORG}` }) });
  await expect(entry).toBeVisible();

  const bullets = [
    "Built a Python pipeline that forecast customer churn for 12,000 accounts, cutting manual reporting by 40%",
    "Wrote SQL models over 3 million rows to feed a dashboard used by 25 analysts",
  ];
  for (const text of bullets) {
    await entry.getByRole("button", { name: "Add a bullet" }).click();
    await entry.getByLabel("New bullet").fill(text);
    await entry.getByRole("button", { name: "Add bullet", exact: true }).click();
    await expect(entry.getByText(text)).toBeVisible();
  }

  // 4. Tailor the job: the project is listed under Added from the bank.
  await page.goto(`/jobs/${jobId}`);
  await page.getByRole("button", { name: "Tailor my CV for this role" }).click();
  const added = page.getByRole("list", { name: "Added from your bank" });
  await expect(added).toBeVisible({ timeout: 120_000 });
  const removeBtn = added.getByRole("button", { name: new RegExp(`^Remove .*${PROJECT_TITLE}`) });
  await expect(removeBtn.first()).toBeVisible();

  // 5. Remove it: it moves to "Left out for this role".
  await removeBtn.first().click();
  await expect(added.getByRole("button", { name: new RegExp(`^Remove .*${PROJECT_TITLE}`) })).toHaveCount(0);
  const leftOut = page.locator("details").filter({ has: page.locator("summary", { hasText: /^Left out for this role \(\d+\)$/ }) });
  await leftOut.locator("summary").click();
  const addBack = leftOut.getByRole("button", { name: new RegExp(`^Add back .*${PROJECT_TITLE}`) });
  await expect(addBack.first()).toBeVisible();

  // Add it back so the PDF carries the project too.
  await addBack.first().click();
  await expect(added.getByRole("button", { name: new RegExp(`^Remove .*${PROJECT_TITLE}`) }).first()).toBeVisible();

  // 6. The tailored PDF is exactly one page.
  const res = await page.request.get(`/api/tailored/${jobId}`);
  expect(res.ok()).toBe(true);
  expect(res.headers()["content-type"]).toContain("pdf");
  const pdf = await getDocumentProxy(new Uint8Array(await res.body()));
  expect(pdf.numPages).toBe(1);

  expect(errors.filter((e) => !/404/.test(e))).toEqual([]);
});

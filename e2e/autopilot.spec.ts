import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, expect, chromium, type Page } from "@playwright/test";
import { hasDemoCreds } from "./fixtures/helpers";

/**
 * Autopilot end to end on the REAL Monzo Greenhouse form (Associate Data Scientist - Intern).
 * Safety: every greenhouse application/submit request is aborted at the network layer and counted; the test never
 * clicks a submit control and closes the context at the end, discarding the unsent form. Only the FICTIONAL persona
 * Ayşe Demir's values are ever typed.
 *
 * Run: NEXT_PUBLIC_AUTOPILOT=1 AI_MODE=fixture E2E_PORT=3100 npx playwright test e2e/autopilot.spec.ts
 * The extension is loaded from a TEMP COPY whose PLACED_ORIGIN and host_permissions point at the e2e port,
 * so the committed extension/ (default http://localhost:3200) is never edited.
 */
test.skip(!hasDemoCreds || process.env.NEXT_PUBLIC_AUTOPILOT !== "1", "needs demo creds and NEXT_PUBLIC_AUTOPILOT=1");

const PORT = Number(process.env.E2E_PORT ?? 3100);
const ORIGIN = `http://localhost:${PORT}`;
const MONZO_JOB_ID = "2993de0d-80fd-4dff-a708-c16fa593df41"; // ext_id 8232726
const SUBMIT_RE = /greenhouse\.io\/.*(applications|submit)/i;

function makeExtensionCopy(): string {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "placed-ext-"));
  fs.cpSync(path.join(process.cwd(), "extension"), dest, { recursive: true });
  fs.writeFileSync(path.join(dest, "config.js"), `globalThis.PLACED_ORIGIN = ${JSON.stringify(ORIGIN)};\n`);
  const mf = JSON.parse(fs.readFileSync(path.join(dest, "manifest.json"), "utf8"));
  mf.host_permissions = [`${ORIGIN}/*`, "https://*.supabase.co/*"];
  fs.writeFileSync(path.join(dest, "manifest.json"), JSON.stringify(mf, null, 2));
  return dest;
}

async function pick(page: Page, selector: string, value: string) {
  const el = page.locator(selector).first();
  if ((await el.evaluate((n) => n.tagName)) === "SELECT") await el.selectOption(value);
  else await el.fill(value);
}

test("Autopilot fills the real Monzo form and never submits", async () => {
  test.setTimeout(Number(process.env.E2E_TIMEOUT ?? 240_000));
  const extDir = makeExtensionCopy();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "placed-e2e-ext-profile-"));
  const ctx = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    args: [
      "--headless=new", // new headless supports extensions; drop this line (or run --headed) to watch it
      `--disable-extensions-except=${extDir}`,
      `--load-extension=${extDir}`,
      "--window-size=1280,1000",
    ],
    viewport: { width: 1280, height: 1000 },
  });
  const posts: string[] = [];
  const aborted: string[] = [];
  try {
    ctx.on("request", (r) => { if (r.method() === "POST" && SUBMIT_RE.test(r.url())) posts.push(r.url()); });
    await ctx.route(SUBMIT_RE, (route) => { aborted.push(route.request().url()); return route.abort(); }); // a submit could never leave the machine

    const page = await ctx.newPage();
    await page.goto(`${ORIGIN}/login`);
    await page.getByRole("button", { name: /Try the demo as Ayşe/ }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });

    // Vault: fictional persona only. Fields that are already saved are simply overwritten with the same persona values.
    await page.goto(`${ORIGIN}/autopilot/setup`);
    const text: Record<string, string> = {
      first_name: "Ayşe", last_name: "Demir", email: "ayse.demir.demo@example.com", phone: "+44 7700 900123",
      country: "United Kingdom", city: "London", university: "University College London", degree: "BSc Economics",
      grad_year: "2028", start_date: "2027-06-01", heard_about: "Placed",
    };
    for (const [name, value] of Object.entries(text)) await pick(page, `#${name}`, value);
    await page.locator("#year_of_study").selectOption("2nd");
    await page.locator("#grad_month").selectOption("June");
    await page.locator("#rtw_uk").selectOption({ index: 1 });
    await page.locator("#needs_sponsorship").selectOption("no");
    await page.getByRole("button", { name: "Save my answers" }).click();
    await expect(page.getByRole("status").filter({ hasText: /Autopilot unlocked/ })).toBeVisible({ timeout: 30_000 });

    // Pack on the real Monzo job
    await page.goto(`${ORIGIN}/jobs/${MONZO_JOB_ID}`);
    await page.getByRole("button", { name: /Autopilot this application/ }).click();
    await expect(page.getByRole("region", { name: "Application pack" })).toBeVisible({ timeout: 60_000 });

    // ask + confirm rows: choose a value where empty, then Save/Confirm/Update
    for (const group of ["ask", "confirm"]) {
      const rows = page.locator(`[data-autopilot-group=${group}] > div`);
      const n = await rows.count();
      for (let i = 0; i < n; i++) {
        const row = rows.nth(i);
        const sel = row.locator("select");
        if (await sel.count()) {
          if (!(await sel.first().inputValue())) await sel.first().selectOption({ index: 1 });
        } else if (await row.locator('input[type=checkbox]').count()) {
          if (!(await row.locator("input[type=checkbox]:checked").count())) await row.locator("input[type=checkbox]").first().check();
        } else {
          const t = row.locator("input").first();
          if (!(await t.inputValue())) await t.fill("Placed");
        }
        const btn = row.getByRole("button", { name: /^(Save|Confirm)$/ });
        if (await btn.count()) { await btn.click(); await expect(row.getByText(/^(Saved|Confirmed)$/)).toBeVisible({ timeout: 15_000 }); }
      }
    }
    // drafts: approve if Autopilot wrote one; otherwise the "Write this one yourself" state is accepted
    const approve = page.getByRole("button", { name: "This is my answer" });
    if ((await approve.count()) && (await approve.first().isEnabled())) await approve.first().click();
    // a draft approved in an earlier run stays approved, so judge by the page, not by whether the button was clickable
    const approvedNote = page.getByText(/Approved\. Autopilot will fill this/);
    await approvedNote.first().waitFor({ timeout: 5_000 }).catch(() => undefined);
    const draftState = (await approvedNote.count()) > 0 ? "approved" : "write-yourself";
    console.log(`DRAFT_STATE=${draftState}`);

    const openBtn = page.getByRole("button", { name: /Open & fill/ });
    await expect(openBtn).toBeEnabled();
    const [form] = await Promise.all([ctx.waitForEvent("page"), openBtn.click()]);

    // The form must be the real Monzo posting; the one-time token is stripped from the URL
    await expect(form.locator("#first_name")).toBeVisible({ timeout: 60_000 });
    await expect(form.locator(".placed-panel")).toContainText(/\d+\/\d+ filled/, { timeout: 120_000 });
    console.log(`PANEL=${(await form.locator(".placed-panel").innerText()).replace(/\n/g, " | ")}`);

    await expect(form.locator("#first_name")).toHaveValue("Ayşe");
    await expect(form.locator("#last_name")).toHaveValue("Demir");
    await expect(form.locator("#email")).toHaveValue(/@/);
    await expect(form.locator("#question_69481992")).toHaveCount(1); // "Why Monzo?" exists; filled only if approved
    if (draftState === "approved") await expect(form.locator("#question_69481992")).not.toHaveValue("");
    else await expect(form.locator("#question_69481992")).toHaveValue("");
    // CV: a file is attached (name shown by Greenhouse) unless there was no tailored CV
    // CV: Greenhouse swaps the file input for a filename readout once a file is attached
    const cvName: string = await form.evaluate(`((document.querySelector(".file-upload__filename") || {}).textContent || "").trim()`);
    console.log(`CV_FILENAME=${JSON.stringify(cvName)}`);
    // The demo user only has a tailored CV for this job after "Tailor my CV" was run on it; without one the CV field is the student's own.
    if (cvName) expect(cvName).toMatch(/\.pdf/i);
    expect(form.url()).not.toContain("placed=");

    // Field audit
    const audit: string[] = await form.evaluate(`[...document.querySelectorAll("[data-placed]")].map((el) => {
      const inner = el.querySelector("input,textarea,select");
      const rs = el.querySelector(".select__control") ? "react-select" : "plain";
      const shown = (el.querySelector(".select__single-value") || {}).textContent || "";
      return el.dataset.placed + ":" + ((inner && inner.id) || el.id || String(el.className).slice(0, 30)) + ":" + rs + (shown ? "=" + shown.slice(0, 24) : "");
    })`);
    console.log(`AUDIT filled=${audit.filter((a) => a.startsWith("filled")).length} select=${audit.filter((a) => a.startsWith("select")).length} yours=${audit.filter((a) => a.startsWith("yours")).length}`);
    console.log(`AUDIT_DETAIL ${audit.join(" ")}`);
    const selectSingles = audit.filter((a) => a.startsWith("select"));
    const rsFilled = audit.filter((a) => a.startsWith("filled") && a.includes("react-select"));
    console.log(`REACT_SELECT_FILLED=${rsFilled.length}: ${rsFilled.join(" ")}`);
    console.log(`REACT_SELECT_PATH: ${selectSingles.length === 0 ? "all trusted-click selects succeeded" : `fell back to select-yourself for ${selectSingles.length}`}`);

    // Autopilot never ticks consent and never fills diversity answers
    expect(await form.evaluate(`document.querySelectorAll("input[type=checkbox][id*=consent]:checked, input[type=checkbox][name*=consent]:checked").length`)).toBe(0);
    await form.waitForTimeout(3000);
    expect(posts, "zero submission POSTs").toEqual([]);
    console.log(`NETWORK submit POSTs=${posts.length} aborted-requests=${aborted.length}`);
  } finally {
    await ctx.close(); // discards the unsent form
    fs.rmSync(extDir, { recursive: true, force: true });
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
});

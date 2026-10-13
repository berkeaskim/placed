import path from "node:path";
import os from "node:os";
import { expect, type Page, type ConsoleMessage } from "@playwright/test";

const TMP = path.join(os.tmpdir(), "placed-e2e");
export const AUTH_FILE = path.join(TMP, "demo-auth.json");
export const GEN = (f: string) => path.join(TMP, "generated", f);
export const hasDemoCreds = Boolean(process.env.DEMO_EMAIL && process.env.DEMO_PASSWORD);

/** Collect console errors + uncaught page errors. Ignores HMR/dev-only noise. */
export function trackConsole(page: Page) {
  const errors: string[] = [];
  page.on("console", (m: ConsoleMessage) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/Download the React DevTools|\[HMR\]|\[Fast Refresh\]/.test(t)) return;
    errors.push(t);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

export async function expectNoHorizontalScroll(page: Page) {
  const r = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
    offenders: [...document.querySelectorAll("body *")]
      .filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${(el.className?.toString() ?? "").slice(0, 60)}`),
  }));
  expect(r.sw, `horizontal overflow; offenders: ${r.offenders.join(" | ")}`).toBeLessThanOrEqual(r.cw);
}

/** Basic static a11y: labelled inputs, named buttons/links, exactly one h1. */
export async function basicA11y(page: Page) {
  const problems = await page.evaluate(() => {
    const out: string[] = [];
    const name = (el: Element) =>
      (el.getAttribute("aria-label") ?? "").trim() ||
      (el.getAttribute("aria-labelledby") ?? "").split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join("").trim() ||
      (el.textContent ?? "").trim() ||
      (el.getAttribute("title") ?? "").trim();
    for (const el of document.querySelectorAll("input, select, textarea")) {
      const i = el as HTMLInputElement;
      if (i.type === "hidden" || i.getAttribute("aria-hidden") === "true") continue;
      const labelled = (i.labels && i.labels.length > 0) || i.getAttribute("aria-label") || i.getAttribute("aria-labelledby") || i.getAttribute("title");
      if (!labelled) out.push(`unlabelled <${i.tagName.toLowerCase()} type=${i.type} name=${i.name} placeholder=${i.placeholder}>`);
    }
    for (const el of document.querySelectorAll("button, [role=button], [role=switch], a[href]")) {
      if ((el as HTMLElement).closest("[aria-hidden=true]")) continue;
      if (!name(el)) out.push(`unnamed <${el.tagName.toLowerCase()} role=${el.getAttribute("role")} class=${(el.className?.toString() ?? "").slice(0, 50)}>`);
    }
    const h1 = document.querySelectorAll("h1").length;
    if (h1 !== 1) out.push(`expected 1 <h1>, found ${h1}`);
    return out;
  });
  return problems;
}

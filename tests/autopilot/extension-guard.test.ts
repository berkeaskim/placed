import { describe, it, expect, vi } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { isSubmitControl, safeClick } = require("../../extension/lib/guard.js");

type El = { tagName: string; type?: string; attrs?: Record<string, string>; form?: unknown; parent?: El | null; click?: () => void; text?: string; id?: string; className?: string };
const el = (o: El) => ({
  tagName: o.tagName, type: o.type, form: o.form ?? null, textContent: o.text, id: o.id, className: o.className,
  getAttribute: (k: string) => o.attrs?.[k] ?? null,
  closest: (sel: string) => { let p: El | null | undefined = o.parent; while (p) { if (sel.includes(p.tagName.toLowerCase())) return el(p); p = p.parent; } return null; },
  click: o.click ?? vi.fn(),
});

describe("submit guard", () => {
  it("flags every submit form", () => {
    expect(isSubmitControl(el({ tagName: "BUTTON", type: "submit" }))).toBe(true);
    expect(isSubmitControl(el({ tagName: "INPUT", type: "submit" }))).toBe(true);
    expect(isSubmitControl(el({ tagName: "INPUT", type: "image" }))).toBe(true);
    expect(isSubmitControl(el({ tagName: "SPAN", parent: { tagName: "BUTTON", type: "submit" } }))).toBe(true);
    expect(isSubmitControl(el({ tagName: "BUTTON", attrs: {}, form: {} }))).toBe(true); // a button with no type inside a form submits
  });
  it("allows options and checkboxes", () => {
    expect(isSubmitControl(el({ tagName: "DIV", attrs: { role: "option" } }))).toBe(false);
    expect(isSubmitControl(el({ tagName: "INPUT", type: "checkbox" }))).toBe(false);
    expect(isSubmitControl(el({ tagName: "BUTTON", type: "button", attrs: { type: "button" } }))).toBe(false);
  });
  it("safeClick throws on submit and never calls click", () => {
    const click = vi.fn();
    expect(() => safeClick(el({ tagName: "BUTTON", type: "submit", click }))).toThrow(/never submits/);
    expect(click).not.toHaveBeenCalled();
  });

  // Live DOM facts (2026-10-14): JS-driven submit buttons that are NOT type=submit.
  it("flags JS submit buttons by id, class or text (Lever, Ashby)", () => {
    // Lever: <button type="button" id="btn-submit" class="postings-btn template-btn-submit">Submit application</button>
    expect(isSubmitControl(el({ tagName: "BUTTON", type: "button", attrs: { type: "button" }, id: "btn-submit", className: "postings-btn template-btn-submit black", text: "Submit application" }))).toBe(true);
    // Ashby: no <form> at all; the submit is a typeless button with an onClick handler.
    expect(isSubmitControl(el({ tagName: "BUTTON", type: "submit", className: "_submitButton_5yu8i_411 ashby-application-form-submit-button", text: "Submit Application" }))).toBe(true);
    expect(isSubmitControl(el({ tagName: "BUTTON", type: "button", attrs: { type: "button" }, text: "Send application" }))).toBe(true);
    expect(isSubmitControl(el({ tagName: "DIV", attrs: { role: "button" }, text: "Apply now" }))).toBe(true);
    expect(isSubmitControl(el({ tagName: "INPUT", type: "button", attrs: { value: "Submit" } }))).toBe(true);
    expect(isSubmitControl(el({ tagName: "SPAN", text: "Submit", parent: { tagName: "BUTTON", type: "button", attrs: { type: "button" }, text: "Submit" } }))).toBe(true);
  });
  it("does not flag options or labels that merely mention applying", () => {
    expect(isSubmitControl(el({ tagName: "DIV", attrs: { role: "option" }, text: "I will apply for a visa" }))).toBe(false);
    expect(isSubmitControl(el({ tagName: "INPUT", type: "radio", attrs: { value: "Submitted already" } }))).toBe(false);
  });
  it("treats null as not a submit control and safeClick refuses null", () => {
    expect(isSubmitControl(null)).toBe(false);
    expect(() => safeClick(null)).toThrow();
  });
});

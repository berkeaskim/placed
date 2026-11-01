import { describe, expect, it } from "vitest";
import { DESKTOP_PORT } from "@/lib/desktop";
import { APP_PORT, APP_URL, canOpenExternally, isAppUrl, isInside } from "../../desktop/src/lib/urls";

describe("app origin", () => {
  it("matches lib/desktop.ts DESKTOP_PORT (the shell cannot import app code)", () => {
    expect(APP_PORT).toBe(DESKTOP_PORT);
    expect(APP_URL).toBe("http://127.0.0.1:3917/");
  });
});

describe("isAppUrl", () => {
  it("keeps only http://127.0.0.1:3917 in the app window", () => {
    expect(isAppUrl("http://127.0.0.1:3917/feed")).toBe(true);
    expect(isAppUrl("http://127.0.0.1:3917")).toBe(true);
    expect(isAppUrl("http://localhost:3917/")).toBe(false);
    expect(isAppUrl("http://127.0.0.1:3000/")).toBe(false);
    expect(isAppUrl("https://127.0.0.1:3917/")).toBe(false);
    expect(isAppUrl("https://jobs.example.com/apply")).toBe(false);
    expect(isAppUrl("not a url")).toBe(false);
  });
});

describe("canOpenExternally", () => {
  it("hands only web and mail links to the OS", () => {
    expect(canOpenExternally("https://www.linkedin.com/in/me/")).toBe(true);
    expect(canOpenExternally("http://example.com")).toBe(true);
    expect(canOpenExternally("mailto:hr@example.com")).toBe(true);
    expect(canOpenExternally("file:///Applications/Calculator.app")).toBe(false);
    expect(canOpenExternally("javascript:alert(1)")).toBe(false);
    expect(canOpenExternally("smb://evil/share")).toBe(false);
    expect(canOpenExternally("garbage")).toBe(false);
  });
});

describe("isInside", () => {
  it("accepts the folder itself and paths under it, rejects escapes", () => {
    expect(isInside("/u/data", "/u/data")).toBe(true);
    expect(isInside("/u/data", "/u/data/files/cv.pdf")).toBe(true);
    expect(isInside("/u/data", "/u/data/../secret")).toBe(false);
    expect(isInside("/u/data", "/u/data-other")).toBe(false);
    expect(isInside("/u/data", "/Applications/Calculator.app")).toBe(false);
  });
});

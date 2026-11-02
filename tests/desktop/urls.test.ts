import { describe, expect, it } from "vitest";
import { DESKTOP_PORT } from "@/lib/desktop";
import { APP_PORT, APP_URL, canOpenExternally, isAppUrl, isOpenableFolder, newWindowTarget } from "../../desktop/src/lib/urls";

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

describe("isOpenableFolder", () => {
  const allowed = ["/u/data", "/u/logs"];
  it("accepts exactly the allowed folders (trailing slash or ./ allowed)", () => {
    expect(isOpenableFolder("/u/data", allowed)).toBe(true);
    expect(isOpenableFolder("/u/logs/", allowed)).toBe(true);
    expect(isOpenableFolder("/u/data/./", allowed)).toBe(true);
  });

  it("rejects anything under them, escapes, siblings, relative paths and non-strings", () => {
    expect(isOpenableFolder("/u/data/files/cv.pdf", allowed)).toBe(false);
    expect(isOpenableFolder("/u/data/run.command", allowed)).toBe(false);
    expect(isOpenableFolder("/u/data/../secret", allowed)).toBe(false);
    expect(isOpenableFolder("/u/data-other", allowed)).toBe(false);
    expect(isOpenableFolder("data", allowed)).toBe(false);
    expect(isOpenableFolder("/Applications/Calculator.app", allowed)).toBe(false);
    expect(isOpenableFolder(undefined, allowed)).toBe(false);
    expect(isOpenableFolder(42, allowed)).toBe(false);
  });
});

describe("newWindowTarget", () => {
  it("loads Placed pages in the same window instead of a new untracked one", () => {
    expect(newWindowTarget(`${APP_URL}jobs/123`)).toBe("same-window");
  });

  it("sends web and mail links to the default browser", () => {
    expect(newWindowTarget("https://example.com/careers")).toBe("browser");
    expect(newWindowTarget("mailto:hr@example.com")).toBe("browser");
    expect(newWindowTarget("http://127.0.0.1:3000/")).toBe("browser");
  });

  it("drops file:, javascript: and garbage", () => {
    expect(newWindowTarget("file:///etc/passwd")).toBe("drop");
    expect(newWindowTarget("javascript:alert(1)")).toBe("drop");
    expect(newWindowTarget("not a url")).toBe("drop");
  });
});

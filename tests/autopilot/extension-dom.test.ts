import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Dom = require("../../extension/lib/dom.js");

const scopeOf = (...texts: string[]) => ({ querySelectorAll: () => texts.map((textContent) => ({ textContent })) }) as never;

describe("PlacedDom.findOption", () => {
  it("folds curly apostrophes on both sides", () => {
    expect(Dom.findOption(scopeOf("I\u2019m a citizen or have permanent residency"), ".o", "I'm a citizen or have permanent residency")?.textContent).toMatch(/citizen/);
    expect(Dom.findOption(scopeOf("I'm a citizen"), ".o", "I\u2019m a citizen")?.textContent).toBe("I'm a citizen");
  });
  it("still matches exactly, case-insensitively, and by prefix only when asked", () => {
    expect(Dom.findOption(scopeOf("No", "Not sure"), ".o", "no")?.textContent).toBe("No");
    expect(Dom.findOption(scopeOf("London, UK"), ".o", "London", false)).toBeNull();
    expect(Dom.findOption(scopeOf("London, UK"), ".o", "London", true)?.textContent).toBe("London, UK");
  });
});

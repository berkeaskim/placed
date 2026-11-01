import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { packOrigins } from "../../scripts/extension-origins.mjs";

const ALL = ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3917", "http://127.0.0.1:3917"];

describe("extension/config.js", () => {
  it("lists the dev and Mac app loopback origins; PLACED_ORIGIN stays the dev default", () => {
    const g: Record<string, unknown> = {};
    vm.runInNewContext(readFileSync("extension/config.js", "utf8"), { globalThis: g });
    expect(g.PLACED_ORIGIN).toBe("http://localhost:3000");
    expect(g.PLACED_ORIGINS).toEqual(ALL);
  });
});

describe("packOrigins", () => {
  it("packs for the desktop origin and still accepts dev origins", () => {
    const o = packOrigins("http://127.0.0.1:3917");
    expect(o[0]).toBe("http://127.0.0.1:3917");
    expect([...o].sort()).toEqual([...ALL].sort());
  });
  it("packs for the dev origin and still accepts the desktop origins", () => {
    const o = packOrigins("http://localhost:3000");
    expect(o[0]).toBe("http://localhost:3000");
    expect([...o].sort()).toEqual([...ALL].sort());
  });
  it("keeps a non-loopback packed origin first and adds the loopback ones", () => {
    const o = packOrigins("https://placed.example");
    expect(o[0]).toBe("https://placed.example");
    expect(o).toEqual(expect.arrayContaining(ALL));
    expect(new Set(o).size).toBe(o.length);
  });
  it("adds the other host for a custom loopback port", () => {
    const o = packOrigins("http://localhost:3200");
    expect(o).toEqual(expect.arrayContaining(["http://127.0.0.1:3200", ...ALL]));
  });
});

import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { toDocumentPoint } = require("../../extension/lib/geometry.js");

// DOM.getNodeForLocation takes DOCUMENT coordinates; getBoundingClientRect / Input.dispatchMouseEvent use the viewport.
describe("toDocumentPoint", () => {
  it("adds the visual viewport's page offset (scrolled page)", () => {
    expect(toDocumentPoint(120, 300, { cssVisualViewport: { pageX: 0, pageY: 1850, clientWidth: 1280, clientHeight: 720 } })).toEqual({ x: 120, y: 2150 });
    expect(toDocumentPoint(40.4, 10.6, { cssVisualViewport: { pageX: 15, pageY: 200.2 } })).toEqual({ x: 55, y: 211 });
  });
  it("is the identity when the page is not scrolled", () => {
    expect(toDocumentPoint(5, 6, { cssVisualViewport: { pageX: 0, pageY: 0 } })).toEqual({ x: 5, y: 6 });
  });
  it("falls back to the legacy visualViewport field", () => {
    expect(toDocumentPoint(1, 2, { visualViewport: { pageX: 10, pageY: 20 } })).toEqual({ x: 11, y: 22 });
  });
  it("refuses (null) without usable metrics or point", () => {
    expect(toDocumentPoint(1, 2, null)).toBeNull();
    expect(toDocumentPoint(1, 2, {})).toBeNull();
    expect(toDocumentPoint(1, 2, { cssVisualViewport: { pageX: "a", pageY: 0 } })).toBeNull();
    expect(toDocumentPoint(Number.NaN, 2, { cssVisualViewport: { pageX: 0, pageY: 0 } })).toBeNull();
  });
});

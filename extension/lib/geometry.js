// CDP coordinate spaces: Input.dispatchMouseEvent and getBoundingClientRect use VIEWPORT CSS pixels, but
// DOM.getNodeForLocation takes DOCUMENT coordinates (scroll included). Convert with Page.getLayoutMetrics.
(function (root) {
  function toDocumentPoint(x, y, metrics) {
    const v = metrics && (metrics.cssVisualViewport || metrics.visualViewport);
    if (!v || !Number.isFinite(v.pageX) || !Number.isFinite(v.pageY) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x: Math.round(x + v.pageX), y: Math.round(y + v.pageY) };
  }
  const api = { toDocumentPoint };
  root.PlacedGeometry = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);

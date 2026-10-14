(function (root) {
  function summarize(fields) {
    const s = { fill: 0, yours: 0, select: 0 };
    for (const f of fields) {
      if (f.mode === "fill") s.fill++;
      else if (f.mode === "select-yourself") s.select++;
      else s.yours++;
    }
    return s;
  }
  const api = { summarize };
  root.PlacedFillPlan = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);

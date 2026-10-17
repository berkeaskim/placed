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
  /** The file a file field takes: the cover letter when the pack says so, otherwise the CV. Null means leave it to the student. */
  function fileFor(field, ctx) {
    return (field.asset === "cover" ? ctx.coverFile : ctx.cvFile) || null;
  }
  const api = { summarize, fileFor };
  root.PlacedFillPlan = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);

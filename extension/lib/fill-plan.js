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
  /** Option labels a multi-select still needs: the plan's labels minus the ones already chosen on the page (compared folded). */
  function stillToPick(field, chosen, norm) {
    const wanted = Array.isArray(field.optionLabels) && field.optionLabels.length ? field.optionLabels : field.optionLabel ? [field.optionLabel] : [];
    const have = new Set(chosen.map(norm));
    return wanted.filter((l, i) => !have.has(norm(l)) && wanted.findIndex((x) => norm(x) === norm(l)) === i);
  }
  const api = { summarize, fileFor, stillToPick };
  root.PlacedFillPlan = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);

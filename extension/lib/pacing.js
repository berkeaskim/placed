// Pacing for the Aurora fill animation: ~450ms a field on short forms, scaled down so the whole run stays near 8s
// (1s "Reading the form…" + 7s of fields) on long ones. The words effect gets its own budget per field.
(function (root) {
  const FIELDS_BUDGET_MS = 7000;
  const MAX_PER_FIELD = 450;
  const MIN_PER_FIELD = 90;

  function perFieldMs(n) {
    if (!(n > 0)) return 0;
    return Math.floor(Math.max(MIN_PER_FIELD, Math.min(MAX_PER_FIELD, FIELDS_BUDGET_MS / n)));
  }

  /** Words and the whitespace between them, so the overlay keeps the exact spacing of the real value. */
  function splitWords(text) {
    return String(text == null ? "" : text).split(/(\s+)/).filter((p) => p !== "");
  }

  /** Stagger between words: 45ms, tighter when the answer is long so the reveal fits budgetMs. */
  function wordStagger(words, budgetMs) {
    if (!(words > 1)) return 45;
    return Math.round(Math.max(6, Math.min(45, (budgetMs > 0 ? budgetMs : 1200) / words)));
  }

  const api = { perFieldMs, splitWords, wordStagger };
  root.PlacedPacing = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);

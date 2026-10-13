# Fairness report: CV Score redaction and judge

Status: 2026-10-13, redaction half implemented. The LLM half waits for `judgeCvRules` (Task 18).
Sources: `docs/research/market-2026/06-scoring-validity-fairness.md` §2–§3, and `docs/superpowers/plans/2026-10-13-cv-amendments.md` (Decisions, Task 25).

## Protocol

- **Fixtures:** 4 fictional UK base CVs in `fixtures/` (SWE, data, consulting, finance). Report 06 asks for 10, so add more when time allows.
- **Variants:** each variant changes exactly one slot (`helpers.ts#fill`).
- **Redaction gate:** the redacted text sent to the judge must be **byte-identical** between base and variant. T1 runs in both heuristic and known-name modes.
- **LLM gate** (once the judge exists): cache off, 3 runs per CV, take the median. Then:
  - |Δtotal| ≤ 2 for each base–variant pair;
  - the mean Δ across bases stays within ±1;
  - no rule verdict flips in more than 1 of 10 bases.

## Test status

| Test | What changes | Gate | Status |
|---|---|---|---|
| T1 | Name (6 personas) | byte-identical | ✅ gated |
| T2 | Name leaks via email, profile slugs, portfolio, signature | no name parts survive | ✅ gated |
| T4 | University | **kept** (product decision) | 📋 reported |
| T6 | Visa / citizenship / sponsorship lines | byte-identical | ✅ gated |
| T8 | Identity societies vs neutral society | identity variants identical | ✅ gated |
| T9 | Disability lines | no disability term survives | ✅ gated |
| T12 | Postcode / street address | byte-identical | ✅ gated |
| T13 | Non-native but error-free phrasing | Δ ≤ 3 (LLM) | ⏳ todo |
| T15 | Human vs Claude-rewritten CV | report Δ; label if >3 (LLM) | ⏳ todo |
| T16 | Section / bullet order | Δ ≤ 2 (LLM) | ⏳ todo |
| T17 | Test-retest ×5 | SD ≤ 2, rule flip ≤ 10% (LLM) | ⏳ todo |
| T19 | Hidden-text injection | score unchanged; covered by `lib/cv/safety.ts` | ⏳ todo |

## Decisions

1. **University and school names are kept** (Berke, 2026-10-13). T4 asserts they are preserved. The judge's prompt guard (R11) tells it not to consider institution prestige.
2. **Only special-category societies are redacted.** Neutral societies (Chess, Finance) carry sector signal. Identity-society variants are byte-identical to each other, and equal the Chess control with "Chess Society" replaced by `[SOCIETY]`.
3. **"Women in Tech" is kept.** Gender is protected, but it is not UK GDPR Art. 9 special-category data, the society is sector-relevant, and pronouns already leak gender. This is a reported item; revisit it if its LLM Δ is above 2.
4. **A bare town is kept** ("London"). A street address or postcode becomes `[ADDRESS]`.

## Known gaps

- **Names:** a name that is also a common word (May, Grace) is only caught as the full name. A surname inside an employer or prize name is also redacted there.
- **Not redacted:** pronouns (T3), a bare home town, and the language itself (e.g. Yoruba, only the "native" label is removed).

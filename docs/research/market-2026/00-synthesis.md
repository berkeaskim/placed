# Market research 2026: synthesis for CV scoring and tailoring

Date: 2026-10-13. Sources: the six reports in this folder (01–06). Every claim below is cited and graded there; this file only joins them up.
Status: the CV Score and tailoring modules are **built** (`lib/cv-rules`, `lib/cv-score`, `lib/verify`, `lib/pdf`). Some recommendations below are visible in code, e.g. `qualifierDrop`, `siblingContamination` and `structuralLoss` in `lib/verify`, and findability bands with a stuffing warning in `lib/scoring/requirements.ts`; the rest have not been traced.
Last re-verified 2026-10-18 against the playbook audit (`docs/research/audit-2026-10-18/10-fit-ats-market.md`).

## 1. The findings that change the design

1. **The CV is a weaker signal in 2026, but not dead.** About 141 applications per graduate vacancy (ISE 2026) and 101 per internship hire (ISE 2025). Since LLMs, a tailored application counts for less: on Freelancer.com the link between how closely a letter matched the post and getting a callback fell 51% (Cui 2025). Banks, MBB, quant and tech still screen on the CV; PwC, Deloitte, law firms and the Fast Stream use forms and tests first. (01, 02)
2. **AI polish does not win interviews, and suspected AI is penalised.** Recruiters spot AI no better than chance, but they mark down applications they suspect. 35% of UK employers try to monitor candidate AI use, and 75% of those (about 26% of all employers) have rejected a candidate for it (CIPD, 22 Sep 2026). (02)
3. **Clarity, specificity and real experience have causal evidence.** Writing help raised hires 8% (Wiles, *Management Science* 2025). Internships add 12–14% to callbacks, volunteering about 7 points, and listing AI skills 8–15 points. GPA had no effect in one audit. The "40% of bullets quantified" rule has no randomised evidence (downgrade to C). (02)
4. **The "75% of CVs rejected by ATS" claim is a myth.** Vendors rank CVs requirement by requirement, often with an LLM. Real auto-rejection comes from knockout questions and test cut-offs. No vendor publishes a match-% threshold; the "aim for 75–80%" figure comes from Jobscan's own blog. (03)
5. **AI screeners prefer AI-written CVs (67–82%), and so would our own scorer.** A Claude-tailored CV scored by Claude would get an inflated score. (03, 06)
6. **Unguarded LLM tailoring fabricates in almost every run, and still in about half even with a strict prompt.** A 2026 preprint (Takano, grade C: single author, 10 synthetic CVs) found almost every unguarded run added an unsupported claim. The most common failure is swapping in a related tool (AWS→Azure). About half of subtle qualifier drops and plausible additions survived human review. A deterministic gate is mandatory. (05)
7. **Gap requirements in the job description act as bait.** The model claims an absent requirement 47% of the time unguarded, and 5% with guardrails. Gap skills must never be sent to the generator. (05)
8. **LLM-as-judge is noisy even at temperature 0, by up to 15% between runs.** Binary yes/no criteria are much more reliable than 1–5 scales. Stability should come from caching, not temperature. (06)
9. **Feedback about the person ("you're a 54") can backfire.** Lead with the single next fix, and give XP only for verified fixes. Explanations raise trust regardless of correctness, so every fix must quote the CV line it refers to. (06)
10. **No competitor cites its rules or shows a fabrication report.** UK university tools (VMock, CV360) give one generic score with no sector or year weighting. These are the open gaps. (04)
11. **Graduate route shortens from January 2027.** Bachelor's and master's Graduate-route applications made on or after 1 Jan 2027 get 18 months instead of 2 years; PhD stays at 3 years (Home Office Statement of Changes, 14 Oct 2025, via PIE News and UKCISA, B). This affects 2026–27 international finalists applying to 2027 graduate schemes. (01)

## 2. Red flags for the current spec

| Spec item | Change |
|---|---|
| CV Score weights | Clarity 25 / Impact 25 / Relevance 25 / ATS 15 / UK conventions 10 (02) |
| "≥40% quantified" rule | Evidence A → C; lower severity (02) |
| LLM rules graded 1–5 or "partial" | Make every rule binary, with pass and fail anchors, and check the evidence quote exists in the code (06) |
| PII stripping (G-37) | Also redact university/school names, visa lines and sensitive society/health terms (06) |
| `parseCV` sends the raw PDF | Run hidden-text and injection checks first; wrap the CV in an untrusted `<cv>` block (03) |
| `verifyTailoring` | Add `qualifierDrop`, `siblingContamination` (related-tool swap), `structuralLoss`, and per-source number scoping (05) |
| Tailored CV re-scored by the same LLM | Show which rules improved; never present the AI-judged delta as proof (03, 06) |
| Keyword coverage as the main % | Lead with must-haves met (n/m); show keyword coverage as "findability", capped, with a stuffing warning (03, 04) |
| Product copy | Never "beat the ATS" or "% more interviews". Use: "measures how well your CV follows conventions, not your chance of an interview" (05, 06) |
| Anthropic Citations API | Not compatible with structured outputs; keep `sourceRefs[]` and verify in code (05) |

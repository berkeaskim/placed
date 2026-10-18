# 05 — The science and engineering of CV tailoring

Researcher 5 of 6 · 2026-10-13 · last re-verified 2026-10-18 against `docs/research/audit-2026-10-18/10-fit-ats-market.md` · Scope: does tailoring work, bullet quality, LLM résumé-rewriting failure modes, fabrication detection, gap handling, AI-rewrite UX, cover letters.
Read alongside: spec §7.1 (`tailorCV`), §7.3 (`verifyTailoring`), §8 (tailoring screen); `career-ops-extraction.md` §4.

**Evidence grades:** **A** = peer-reviewed / RCT / court judgment · **B** = preprint from a credible group, NBER WP, strong institutional report, official vendor docs · **C** = practitioner / employer guidance, or a single small preprint graded down (Takano 2608.26171, Chen & Xiao 2609.16517 and Tan et al. 2603.05189 are C across 02/05/06 as of 2026-10-18) · **D** = our inference.

> **TL;DR.** Better-written, job-aligned applications measurably raise hires and callbacks (A/B). But a 2026 preprint found almost every unguarded LLM résumé-rewriting run added an unsupported claim (C), and **prompt guardrails alone still left fabrication in ~50 %** (C). Human review catches flagrant lies but about half of subtle qualifier drops and plausible additions survived it (C). So the right architecture is layered: (1) a constrained generator that must cite source bullet IDs, (2) a **deterministic** diff gate (numbers, entities, skills, verbs, qualifiers), (3) an optional cheap LLM entailment check, and (4) a **diff UI that shows each change next to its source line**, so checking costs the student seconds. Placed's spec already covers about 80 % of this. The gaps worth adding are a **qualifier-drop check**, **sibling-tool contamination**, a **JD "trap" requirement in the demo**, and **no Anthropic Citations API** (it is incompatible with structured outputs).

---

## 1. Findings

### A. Does tailoring or better writing measurably improve outcomes?

**F1. Better résumé writing causes more hires, with no loss of employer satisfaction.** In a field experiment on an online labour market (Upwork-like), ≈480k jobseekers ("nearly half a million") were randomised to algorithmic writing assistance (error correction and clarity, *not* JD tailoring). Result: **+8 % hires; +10 % wages (published version)**. The 8.4 % wage figure is from an earlier draft; the ~195k sample size previously quoted here could not be verified. Do not quote either. Employer ratings of hired workers were unchanged (8.84 vs 8.835/10). The gains concentrated among the weakest writers. — Wiles, Munyikwa & Horton, *Management Science* 71(12), 2025; NBER WP 30886 (2023). https://www.nber.org/papers/w30886 · https://arxiv.org/abs/2301.08083 — **A**
*Caveat:* the intervention improved clarity, not tailoring. It supports "clean, clear bullets" more than "keyword matching".

**F2. Tailoring an application to the posting raised callbacks, but the effect faded and the signal value collapsed.** Freelancer.com launched an "AI Bid Writer" (Apr 2023) that generates cover letters tailored to the job post. Data: 5M cover letters, >100k jobs.
- Access raised callbacks by **+0.43 pp (≈ +6 %)** on a 7.02 % base.
- Actual use (LATE) raised them by **+3.56 pp (≈ +51 %)**, but this is only significant at the 10 % level, and the effect **tapered after ~2 months**.
- The correlation between tailoring and callbacks **fell 51 %** (and 79 % for offers). Employers shifted toward harder-to-fake signals such as work history.
- **Minutes spent editing the AI draft were positively associated** with callbacks and offers. This is a correlation only: +1 SD (3.5 min) ↔ +0.31 pp win probability, ≈ 52 % of the base rate.

— Cui, Dias & Ye (Yale), arXiv 2509.25054, v2 Nov 2025. https://arxiv.org/abs/2509.25054 — **B**

**F3. Before LLMs, employers paid a premium for customised applications. After LLMs, they no longer did.** Structural model on Freelancer.com: without costly signalling, top-quintile workers are hired **19 % less** and bottom-quintile workers **14 % more**. — Galdin & Silbert, "Making Talk Cheap", arXiv 2511.08785 (2025). https://arxiv.org/abs/2511.08785 — **B**
*Implication (D):* generic AI tailoring is becoming table stakes with a decaying edge. What still differentiates is **specific, verifiable evidence**: real projects, real numbers and a real "why this firm".

**F4. Presentation-only rewrites can move callbacks in a preregistered UK field audit.** Listing jobs by *years worked* rather than dates raised callbacks ~8 % (no gap) and ~15 % (with a gap); n = 9,022 real UK applications. The mechanism was making experience salient. Caveat: tested on mid-career profiles (5 and 15 years' experience); transfer to student CVs is untested. — Kristal, Nicks, Gloor & Hauser, *Nat Hum Behav* 2023, online Dec 2022. https://pmc.ncbi.nlm.nih.gov/articles/PMC7614241 — **A**
*Relevance:* honest reframing of the *same facts* can matter. This is exactly the "🔁 made visible by rephrasing" category in spec §8.

**F5. Exact-criteria screening is real, according to employers.** **88 %** of surveyed employers agreed that qualified high-skill candidates are screened out because they don't match the exact criteria in the job description (2,275 executives across US/UK/DE, plus 8,720 workers). — Fuller, Raman et al., HBS & Accenture, "Hidden Workers: Untapped Talent" (2021). https://www.library.hbs.edu/working-knowledge/how-to-tap-the-talent-automated-hr-platforms-miss — **B** (survey, self-report)
*Separate claim from evidence:* the popular claim that "75 % of CVs are auto-rejected by ATS" has **no credible primary source** that we could find. Treat keyword coverage as a *plausible* lever, not a proven one.

**F6. No RCT isolates "CV tailored to this JD" vs "same CV untailored".** The closest evidence is F2 and F3 (cover letters/bids), F1 (writing quality) and one n = 1-candidate case study: a multi-source RAG tailor raised an *ATS-style proxy* score by +7.8 points where relevant experience existed and *lowered* it by 8 points where it did not. — arXiv 2605.05257 (2026). https://arxiv.org/abs/2605.05257 — **B−/D** (proxy metric, single candidate)
**Honest pitch line for Placed:** "evidence shows clearer, job-relevant applications get more callbacks". Do **not** say "tailoring gets you X % more interviews".

### B. Bullet quality: formats, quantification, verbs

**F7. X-Y-Z is employer-authoritative guidance, not experimental evidence.** Google's former SVP People Ops, Laszlo Bock: *"Accomplished [X] as measured by [Y], by doing [Z]"*, i.e. lead with an active verb, quantify, give a baseline, and say how. — Business Insider / LinkedIn (2014–2016). https://www.businessinsider.in/Googles-former-HR-boss-says-this-is-the-key-to-a-perfect-resume/articleshow/54925993.cms — **C**
UK university careers services give equivalent guidance: tailor to the job description, put the most relevant experience early, two sides of A4 for graduate roles. — University of Sheffield Careers. https://sheffield.ac.uk/careers/support/apply/cv/writing — **C**
STAR and CAR are interview and competency-answer frameworks used by UK graduate recruiters. We found no peer-reviewed comparison of X-Y-Z vs STAR vs CAR for CV bullets. — **D**

**F8. Quantification is the most common fabrication vector when an LLM "improves" bullets.** Undefended pipelines invent metrics such as "Reduced API latency by 90 %" when the source had no number. — Indukuri & Agrawal, "Grounded Optimization", arXiv 2607.01457 (Jul 2026). https://arxiv.org/abs/2607.01457 — **B**
*Design rule (D):* the model may **surface** numbers that are already in the CV and may **ask** for numbers. It may never **supply** them. That is the "Confirm this number" dialog in spec §7.3.

**F9. Qualifier inflation is the subtle failure.** Examples are "helped with" → "led", "familiar with" → "expert", or dropping "as part of a team of 4". It is the category human reviewers miss most: about half of subtle qualifier drops and plausible additions survived human review (54.5 % removed, both categories combined). — Takano, arXiv 2608.26171 (v1 Jul 2026, v2 Sep 2026; single author, 10 synthetic CVs). https://arxiv.org/abs/2608.26171 — **C**
*Rewriting-without-inflating rule (D):* a rewrite may change **order, concision, verb tense, and JD-vocabulary synonyms of things already present**. It may not change **scope** (team → solo), **role** (assisted → led), **magnitude** (numbers), **tool identity**, or **certainty** (familiar → proficient).

### C. LLM résumé generation and tailoring research (2023–2026): documented failure modes

**F10. Fabrication is the default, not an edge case.** Setup: a controlled 180-run study (10 synthetic CVs × 2 JDs × 3 reps × 3 conditions) with claim-level ground truth and "absence lists".
- An **un-guarded** résumé-improvement pipeline produced ≥1 unsupported claim in **96.7 %** of outputs (6.8 findings per output). In UI copy, say "a 2026 preprint found almost every unguarded run added an unsupported claim", not "97%". New unsupported claims were 58 % of findings. Invented names and identities appeared in 6/60 outputs.
- A **strict "don't add facts" prompt** cut finding density by 86 % but **still left fabrication in 50 % of outputs**.
- A newer-generation model at baseline still fabricated in **90 %**.

— Takano, arXiv 2608.26171. https://arxiv.org/abs/2608.26171 — **C** (single-author preprint, synthetic CVs)
→ This directly validates Placed's deterministic gate. Prompting alone will not pass a live demo reliably.

**F11. JD "bait" works.** Each JD contained one plausible requirement absent from the CV (a certification, tool, domain or language level). Unguarded pipelines **claimed the candidate met it 47 % of the time**. A guardrail reduced this to 5 %, and a human checkpoint with an explicit JD-requirement audit reduced it to 2 %. The highest-yield bait was a **domain upgrade adjacent to real experience** (marketing → "employer-branding strategy"). — Takano 2608.26171 — **C**

**F12. Failure taxonomy specific to résumé rewriting.** — Indukuri & Agrawal, arXiv 2607.01457 — **B**
- **H1 Temporal fabrication:** e.g. LangChain inserted into a 2019–2021 role.
- **H2 Cross-domain contamination:** an AWS role rewritten with Azure services because the JD said "multi-cloud". This was **79–89 % of baseline incidents**.
- **H3 Structural mutation:** 8 bullets silently condensed to 4–5 generic ones. It removes truth rather than adding falsehood.
- **H4 Content fabrication:** companies, metrics, certifications.

Their mitigations: per-role timeline in the prompt; a **deterministic** 257-service taxonomy diff (before/after per role, flagging only *newly introduced* providers); a bullet-count invariant (|b′| ≥ |b| − 1); immutability rules in the prompt; and a separate-instance LLM evaluator that **defaults to reject on failure**. Prompt grounding alone reached zero detected hallucinations only at low temperature with a strong model.

**F13. Career-switchers and multi-specialty students are the most exposed.** Contamination rose monotonically with the distance between a candidate's specialties (12 → 36 findings). — Takano 2608.26171 — **C**
*Relevance (D):* many Placed users are students pivoting (e.g. history → consulting). Run stricter checks when the target archetype differs from the CV's dominant archetype.

**F14. ResumeFlow (SIGIR 2024 demo) measured only proxies.** It used `job_alignment` (JD-overlap and embedding cosine) and `content_preservation` (overlap with the original). It flagged *"low preservation + high alignment"* as the hallucination signature. — Zinjad et al., arXiv 2402.06221. https://arxiv.org/abs/2402.06221 — **B**
This metric pair is a cheap dashboard signal. Lexical-overlap metrics are, however, poor hallucination detectors: ROUGE-style evaluation has very low precision. — "The Illusion of Progress", arXiv 2508.08285. https://arxiv.org/abs/2508.08285 — **B**

**F15. Fairness: LLM screeners prefer LLM-written résumés.** In a résumé correspondence experiment, LLMs preferred their *own* generated résumés over human-written ones at **67–82 %** self-preference rates. Simulated same-model applicants were **23–60 % more likely to be shortlisted**; a simple intervention cut the bias by >50 %. — "AI Self-preferencing in Algorithmic Hiring", arXiv 2509.00462 (2025). https://arxiv.org/abs/2509.00462 — **B**
In the other direction, human readers penalise *suspected* AI use in hiring evaluations ("perceptual harms"). — "Generative AI and Perceptual Harms", arXiv 2410.00906. https://arxiv.org/abs/2410.00906 — **B**
LLM screeners are also presentation-sensitive: competence-preserving rewrites flipped 30–41 % of pairwise decisions. — Chen & Xiao, arXiv 2609.16517 (under review; six small open models). https://arxiv.org/abs/2609.16517 — **C**
GPT-3.5 *generating* résumés encoded gender and ethnicity stereotypes ("Silicon Ceiling"). — Armstrong et al., arXiv 2405.04412. https://arxiv.org/abs/2405.04412 — **B**
*Implication (D):* don't market "beat the AI screener"; that is an arms race with an ethics problem. Keep the student's own voice (minimal-edit policy, see Pipeline step 4). Never let the tailor change name or demographic markers.

**F16. Lying on a UK CV can be criminal.** It can amount to fraud by false representation (Fraud Act 2006 s.2, maximum 10 years). In *R v Andrewes* [2022] UKSC 24, the Supreme Court upheld confiscation of salary earned through CV lies, reduced proportionately. https://supremecourt.uk/press-summary/uksc-2020-0166.html — **A** (judgment)
*Use (D):* a one-line, non-preachy explanation in the "we didn't invent it" UI and in the pitch: "a fabricated CV line is a legal and reputational risk for the student, not just an ethics nicety".

### D. Fabrication and hallucination detection techniques

**F17. The Anthropic Citations API cannot be combined with structured outputs.** *"Citations cannot be used together with structured outputs … the API returns a 400 error."* Citations do give guaranteed-valid pointers, and `cited_text` is free of output tokens. Custom-content documents allow one citable block per CV bullet. — Anthropic docs, Citations. https://platform.claude.com/docs/en/build-with-claude/citations — **B** (vendor docs)
→ **Keep spec's `sourceRefs[]` inside the Zod schema.** The IDs are model-self-reported, so `orphanBullets` plus deterministic diffing is what actually verifies them. Citations would only make sense in a separate, non-JSON "explain" call. Not worth it for the hackathon.

**F18. Anthropic's own hallucination guidance:** give explicit permission to say "I don't know"; extract direct quotes first; after drafting, find a supporting quote per claim and **retract** any claim without one; restrict to the provided documents; best-of-N inconsistency as a signal. The docs also note these techniques do not eliminate hallucination. — Anthropic docs, "Reduce hallucinations". https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations — **B**

**F19. Claim decomposition plus per-claim grounding is the standard factuality method.** FActScore splits output into atomic facts and checks each against a source; even ChatGPT scored only 58 % on biographies. — Min et al., EMNLP 2023, arXiv 2305.14251. https://arxiv.org/abs/2305.14251 — **A**
Our domain is easier: the **source is closed and tiny** (one CV plus confirmed facts), and each bullet is already ~1–3 atomic claims. Per-bullet checking against its cited source bullets is the right granularity.

**F20. Small or cheap verifiers are competitive with large LLM judges for grounded checking.** MiniCheck-FT5 (770M) reaches GPT-4-level accuracy on LLM-AggreFact at ~400× lower cost. — Tang, Laban & Durrett, EMNLP 2024, arXiv 2404.10774. https://arxiv.org/abs/2404.10774 — **A**
A 1B reasoning verifier (ThinknCheck) beats MiniCheck-7B. — arXiv 2604.01652 — **B**
*For a hackathon (D):* hosting a model is not worth it. Use **Haiku 4.5 as a per-bullet entailment judge** with a tight schema (`supported | partial | unsupported` plus the unsupported span). It is cheap and parallelisable, so it is fine as an advisory layer behind the deterministic gate.

**F21. Aggregating individually true facts can create a false claim.** For example, a number from bullet A gets attached to the project in bullet B. — "Merging Facts, Crafting Fallacies", arXiv 2402.05629. https://arxiv.org/abs/2402.05629 — **B**
→ When a tailored bullet has **>1 `sourceRef`**, number checks must be **scoped**: number *and* its context word must co-occur in the same source bullet (career-ops `hasScopedNumberMatch`, extraction §4.2).

**F22. LLM judges favour their own family's outputs.** — cited in Takano 2608.26171 §2 — **C**
→ The deterministic gate stays authoritative. The Haiku judge is advisory and is told to look for *unsupported spans*, not to rate quality.

### E. Gap handling (JD asks for something the student lacks)

**F23. Gaps are where fabrication is *induced*.** See F11: baited gaps were taken 47 % of the time unguarded. The trap that works best is the one *adjacent* to real experience. — **B**
**Best practice (D, synthesised from F11, F16, F18, F25):**
1. **Never** pass gap skills to the generator. The spec already restricts allowed keywords to `existing` + `supportedByResume`.
2. Show gaps explicitly as "❌ not in your CV — we didn't invent it".
3. Offer **three honest routes**:
   - **(a) Confirm:** "Have you actually used X?" If yes, the student types a one-line evidence statement, which is stored as a timestamped `confirmed_fact` and then becomes allowed.
   - **(b) Adjacent framing:** surface a *real* related bullet with the honest qualifier kept ("Analysed survey data in Python (pandas)" for a "SQL" ask). Never claim X itself.
   - **(c) Close it:** a 1–2-week micro-project or course quest, which feeds the gamification loop.
4. "I don't know / can't confirm" is a durable answer, never re-asked (career-ops four-outcome rule, extraction §4.2).

**F24. Students may under-apply when they don't meet every bullet.** A widely cited claim (HP internal report via HBR 2014) says women apply only when they meet 100 % of criteria. It is **not peer-reviewed** — **C/D**. Spec §7.2's "inferred requirements can't be critical/high" cap is the right defence against over-stating gaps. Show "blocking vs non-blocking" gaps so a missing "nice-to-have" doesn't deter an application.

### F. UX of AI rewriting: accept/reject, trust, over-reliance

**F25. People over-rely on AI suggestions, and explanations alone don't fix it.** Cognitive forcing (making users commit or engage before seeing or accepting AI output) reduced over-reliance but was **rated least pleasant**. — Buçinca, Malaya & Gajos, CSCW 2021, arXiv 2102.09692. https://arxiv.org/abs/2102.09692 — **A**
**Explanations do reduce over-reliance when they lower the cost of verification.** — Vasconcelos et al., CSCW 2023, arXiv 2212.06823. https://arxiv.org/abs/2212.06823 — **A**
→ The key design lever is **showing the source line next to the rewritten bullet** (spec §8.3), with **numbers and changed words highlighted**. Verification becomes a glance, not a re-read.

**F26. Reviewers need tooling for the subtle errors.** After human review, invented identities were caught 100 % of the time, but **qualifier drops and new plausible claims only 54.5 %**. The authors explicitly call for *"automated diff highlighting against source claims and qualifier-preservation checks"* as reviewer support. — Takano 2608.26171 — **C**

**F27. AI-heavy writing reduces psychological ownership; on-demand, sentence-level suggestions and provenance help.**
- Ownership dropped ~0.85–1.0 points on a 7-point scale with AI help, including on a cover-letter task. Style personalisation restored about +0.43. — "Who Owns the Text?", arXiv 2601.10236 (N = 176). https://arxiv.org/abs/2601.10236 — **B**
- Design patterns from that work: on-demand initiation, micro-suggestions, voice anchoring, point-of-decision provenance.
- "AI Ghostwriter Effect": users don't feel they own AI text yet still self-declare as authors. Higher user influence raised ownership. — Draxler et al., ACM TOCHI 2024, arXiv 2303.03283. https://arxiv.org/abs/2303.03283 — **A**
- High scaffolding (paragraph-level) improved quality but lowered ownership and satisfaction. — Dhillon et al., CHI 2024, arXiv 2402.11723. https://arxiv.org/abs/2402.11723 — **A**

→ **Per-bullet accept/reject/edit**, not "replace whole CV". Default to the *smallest* edit that achieves the change. Show "your words kept: 82 %".

**F28. Editing the AI draft is associated with better outcomes.** See F2: editing minutes correlated with callbacks and offers. This is correlational, but it aligns with F27. — **B**
→ Gamify *reviewing*: XP for each bullet the student accepts *after viewing the source*, or edits. Don't give XP for a one-click "accept all".

### G. Cover letters and "why this company"

**F29. AI cover letters gave a short-lived edge and destroyed the signal.** See F2 and F3: callbacks rose briefly, the signal value fell 51–79 %, and employers moved to harder-to-fake signals. Readers penalise disclosed or suspected AI authorship (2410.00906; 2510.24011 https://arxiv.org/abs/2510.24011). — **B**
**What's credible (D):** a short "why this company / why this role" built from **the student's own answers** to 2–3 prompts: what they know about the firm, a specific product, team or news item, and a real link to their experience. The LLM only structures and tightens it. Run the same `verifyTailoring` gate, with the JD and firm facts allowed as *context* but every claim about the *student* sourced. Require at least one student-typed sentence. Our recommendation is to make it **optional and secondary** to the CV for the hackathon.

---

## 2. Recommended tailoring pipeline

```
parseCV (once) ──► CV JSON with stable IDs (exp.e1.b3)
tagJob  (once) ──► requirements[] with importance + evidence_tier   (two-pass rule: set before CV is read)
          │
 [0] DETERMINISTIC PRE-PASS (no LLM, <50 ms)
     skill extraction both sides → buckets: existing / supportedByResume / gap
     allowedKeywords = existing ∪ supportedByResume ∪ confirmed_facts   (gap NEVER passed)
     archetype distance (CV dominant vs JD archetype) → strict mode if far (F13)
          │
 [1] GAP CONFIRMATION (UI, optional, before generation)
     for top critical/high gaps adjacent to CV evidence: "Have you used X?" →
       confirm (1-line evidence → confirmed_facts) / not yet → quest / can't say (durable)
          │
 [2] tailorCV — Sonnet 5.5, structured output (Zod), temperature low (≤0.3)
     input: CV JSON (cached), confirmed_facts, <job_posting> (untrusted), allowedKeywords,
            per-role date ranges (anti-anachronism, F12-H1)
     rules in prompt: reorder > rephrase > never add; keep every qualifier; no new numbers;
            one bullet = one source unless explicitly merged; may output "NEEDS_NUMBER" placeholder
            instead of inventing a metric; may return bullet unchanged (allowed & encouraged)
     output per bullet: {id, text, sourceRefs[], changeType: kept|reordered|rephrased|merged|dropped,
            keywordsAdded[], qualifiersKept[]}, plus changes[] (spec §7.1)
          │
 [3] verifyTailoring — DETERMINISTIC GATE (authoritative; §3 below)
     block → re-prompt once with issue list → still block → revert offending bullets to original
          │
 [4] OPTIONAL entailment judge — Haiku 4.5, parallel per changed bullet (advisory, warn only)
     "Given SOURCE bullets [refs] and confirmed facts, is every claim in AFTER entailed?
      Return {verdict: supported|partial|unsupported, unsupportedSpan, reason}"
     unsupported → mark bullet amber in diff + require explicit student accept
          │
 [5] DIFF REVIEW UI (spec §8) — per-bullet accept / edit / reject; source line shown inline;
     changed numbers & verbs highlighted; NEEDS_NUMBER → "Confirm this number" 4-outcome dialog
          │
 [6] re-run [3] on the student-edited final (edits can introduce issues too) → PDF only if verdict ≠ block
```

**Model choice.** Use Sonnet 5.5 for generation: instruction-following quality matters most here (F12: prompt grounding works only with a capable model at low temperature). Use Haiku 4.5 for the advisory judge (cheap, parallel). The judge is the same model family, so per F22 it is treated as advisory. Run zero LLM calls in the gate.

**Latency budget (D).** Sonnet tailor ≈ 8–15 s for 15–25 bullets. Deterministic gate under 100 ms. Haiku judge ≈ 1–2 s run in parallel. One retry at most. Stream the "What we tailored for" list while the diff renders.

**Fixture mode.** Record one *blocked* run and one *passed* run for the demo persona, so the "reverted — not supported by your CV" path can be shown live (see Implications).

---

## 3. Fabrication detection design

Precision ranking (D, from F10–F22): **deterministic diffs on a closed source** have the highest precision for numbers, entities and skills. **LLM entailment** catches paraphrased scope or role inflation that regex misses, but has lower precision. **Human review with highlighted diffs** catches what is left. Use all three, in that order of authority.

| # | Check | Implementation (deterministic unless noted) | Catches | Action |
|---|---|---|---|---|
| 1 | `inventedMetrics` | career-ops metric regexes (%, £/$/€, ×, N+noun, ranges); normalise digits and thousands. Target set ⊆ source ∪ confirmed_facts, **scoped**: the number must appear in a *cited* source bullet with ≥1 shared context word (F21) | invented or inflated numbers (F8, F12-H4) | block |
| 2 | `unsupportedFacts` | employer / title / degree / cert / institution whole-token match against source; **immutables** (name, employers, titles, dates, degree, grade) must be byte-identical after normalisation | identity and credential fabrication (F10) | block |
| 3 | `skillInjection` | canonical skill set(after) − (source ∪ confirmed_facts) ≠ ∅, using the same `extractSkills` canonicaliser as tagJob | gap skills smuggled in (F11) | block |
| 4 | **`siblingContamination`** (new) | per bullet: tool families {AWS/GCP/Azure}, {PyTorch/TensorFlow/JAX}, {React/Vue/Angular}, {Excel/Sheets}, {Tableau/PowerBI/Looker}, {SQL dialects}… A family member in `after` that is absent from the *cited* source bullets means a swap | cross-domain contamination, the dominant mode (F12-H2) | block |
| 5 | `authorshipEscalation` | verb ladder: `familiar/exposed/learned < used/assisted/supported/helped/contributed < built/developed/implemented < led/owned/managed/founded/spearheaded`. Block if level(after) > level(source) for the same object (≥2 shared content tokens); also delegated → direct (career-ops) | "used → built", "helped → led" (F9) | block |
| 6 | **`qualifierDrop`** (new) | qualifiers present in the source and missing from `after`: `as part of`, `team of N`, `with`, `co-`, `assisted`, `helped`, `contributed to`, `partial`, `~`, `approx`, `up to`, `over N` (as a bound), `module/coursework/university project`, `personal project`, `shadowed` | scope or role inflation that humans miss ~45 % of the time (F9, F26) | block if a team/role qualifier is dropped; warn for hedges |
| 7 | `orphanBullets` | every bullet has ≥1 `sourceRef` resolving to a real ID; `merged` bullets need ≥2 | uncited content | block |
| 8 | **`structuralLoss`** (new) | each role: bullets kept + explicitly `dropped` (with reason) = original count; no silent disappearance | silent condensation (F12-H3) | warn |
| 9 | `perBulletDrift` | new content words not in (source bullet ∪ allowedKeywords) > k (start k = 3); also token-overlap "preservation" score per bullet, ResumeFlow-style (F14) | free invention that slipped the regexes | warn → triggers Haiku judge |
| 10 | **`temporal`** (new, cheap) | skill/tool release-year table for ~40 common tools (LangChain 2022, GPT-4 2023, Next.js 13 App Router 2022…). The tool must not appear in a role whose end date is before its release | anachronism (F12-H1) | block |
| 11 | `forbiddenPhrases` | "proven track record", "world-class", "expert in" (unless source says expert), "seasoned", "visionary"; warn on "passionate", "results-driven" | puffery or unsupported self-assessment | block / warn |
| 12 | `coverage` | ≥2 count-shaped spans but 0 recognised claims → extractor blind spot | false "clean" | warn, never silent pass |
| 13 | LLM `entailment` (Haiku, advisory) | per changed bullet vs cited sources; returns the unsupported span | paraphrased inflation that regex can't see | amber + forced explicit accept |

**Why not NLI models or MiniCheck for the hackathon?** They are accurate (F20) but need a Python or ONNX host. Haiku with a strict schema is "good enough" as an *advisory* layer, and the deterministic rows carry the guarantees. A post-hackathon upgrade path is MiniCheck-FT5 behind an API route.

**Test fixtures to write (D).** These are the cheapest way to make the gate trustworthy:
- (a) source "Helped organise 3 society events" vs after "Led 3 events" → block (#5);
- (b) "Used Python (pandas)" vs "Built ML pipeline in PyTorch" → block (#3/#5);
- (c) "AWS Lambda" vs "Azure Functions" → block (#4);
- (d) "team of 4" dropped → block (#6);
- (e) "increased sign-ups 20 %" vs "increased sign-ups 25 %" → block (#1);
- (f) two refs, number moved across bullets → block (#1, scoped);
- (g) pure reorder plus JD synonym already in the CV → pass;
- (h) JD trap requirement "CFA Level I" with a CV that has none → must appear only in gaps.

---

## 4. Implications and feature ideas for Placed

1. **Pitch with evidence, not hype.** "Clearer, job-relevant applications get hired more: +8 % hires in a field experiment with nearly half a million jobseekers (F1); tailored applications got more callbacks (F2). But a 2026 preprint found almost every unguarded AI rewrite added an unsupported claim (F10), so Placed traces every line back to your CV." This is the differentiator; no consumer tool we know of demonstrates it.
2. **Demo the trap.** Put one plausible-but-absent requirement in the demo JD (e.g. "Tableau" or "CFA Level I") and show it landing in "❌ not in your CV — we didn't invent it". Optionally show the recorded *blocked* first draft being reverted (fixture). Judges will remember it.
3. **Add three checks to spec §7.3**: `qualifierDrop`, `siblingContamination` and `structuralLoss`. The `temporal` check is nice-to-have. These target the documented dominant failure (contamination, F12) and the human blind spot (qualifiers, F26).
4. **Do not use the Anthropic Citations API** for tailorCV, because it is incompatible with structured outputs (F17). Keep `sourceRefs[]` in JSON and verify deterministically.
5. **Diff UI = verification-cost reducer (F25/F26).**
   - Show source line inline.
   - Highlight changed numbers, verbs and skills in colour.
   - Use per-bullet accept/edit/reject, not "accept all".
   - Show "your words kept %" (F27).
   - Make amber (judge-flagged) bullets require an explicit tick.
6. **Gamify honesty and review, not volume.**
   - "Verified CV" badge when the gate passes with zero reverts.
   - XP for confirming a number via the 4-outcome dialog.
   - XP for closing a gap via a quest (micro-project) rather than rewording.
   - XP for edits (F28).
7. **Gap → quest loop.** Each ❌ critical/high gap offers "confirm" / "adjacent evidence" / "start a 1-week quest". This is the strongest bridge between the CV feature and the gamified internship app.
8. **Strict mode for career-switchers** (F13). When the JD archetype is far from the CV archetype, lower the drift threshold and always run the Haiku judge.
9. **Keep the student's voice and avoid the screener arms race** (F15). Don't advertise "ATS/AI-screener beating". Use minimal-edit defaults. Never touch name or demographic markers. Make the keyword-coverage % a diagnostic, not the goal.
10. **Cover letter / "why us": optional, student-sourced** (F29). Ask three questions, have the LLM tighten the answers, run the same gate, and require at least one student-written sentence.
11. **One-line legal reality check** in the gap panel (F16): "Adding skills you don't have can count as fraud in the UK. We only reword what's true."
12. **Metrics for the README or judges:**
    - % of tailored bullets traced to source (target 100 %);
    - reverts per run;
    - keyword coverage before → after;
    - trap-requirement capture rate on our fixture set (target 0 %).

---

### Source list (quick reference)
- Wiles, Munyikwa, Horton — NBER w30886 / Management Science 2025 — https://www.nber.org/papers/w30886 (A)
- Cui, Dias, Ye — Signaling in the Age of AI: Cover Letters — https://arxiv.org/abs/2509.25054 (B)
- Galdin, Silbert — Making Talk Cheap — https://arxiv.org/abs/2511.08785 (B)
- Kristal et al. — Nat Hum Behav 2023, online Dec 2022 (mid-career profiles) — https://pmc.ncbi.nlm.nih.gov/articles/PMC7614241 (A)
- HBS/Accenture — Hidden Workers 2021 — https://www.library.hbs.edu/working-knowledge/how-to-tap-the-talent-automated-hr-platforms-miss (B)
- Takano — Mitigating Fabrication in Multi-Stage LLM Hiring Pipelines — https://arxiv.org/abs/2608.26171 (C)
- Indukuri, Agrawal — Grounded Optimization — https://arxiv.org/abs/2607.01457 (B)
- Resume Tailor case study — https://arxiv.org/abs/2605.05257 (B−)
- ResumeFlow — https://arxiv.org/abs/2402.06221 (B)
- AI self-preferencing in hiring — https://arxiv.org/abs/2509.00462 (B)
- Perceptual harms — https://arxiv.org/abs/2410.00906 (B)
- Chen & Xiao — Presentation sensitivity in LLM screening — https://arxiv.org/abs/2609.16517 (C)
- Silicon Ceiling — https://arxiv.org/abs/2405.04412 (B)
- FActScore — https://arxiv.org/abs/2305.14251 (A)
- MiniCheck — https://arxiv.org/abs/2404.10774 (A)
- Merging Facts, Crafting Fallacies — https://arxiv.org/abs/2402.05629 (B)
- Illusion of Progress (ROUGE) — https://arxiv.org/abs/2508.08285 (B)
- Buçinca et al. CSCW 2021 — https://arxiv.org/abs/2102.09692 (A)
- Vasconcelos et al. CSCW 2023 — https://arxiv.org/abs/2212.06823 (A)
- Draxler et al. TOCHI 2024 — https://arxiv.org/abs/2303.03283 (A)
- Dhillon et al. CHI 2024 — https://arxiv.org/abs/2402.11723 (A)
- Who Owns the Text? — https://arxiv.org/abs/2601.10236 (B)
- Reader perception on AI disclosure — https://arxiv.org/abs/2510.24011 (B)
- Anthropic Citations docs — https://platform.claude.com/docs/en/build-with-claude/citations (B)
- Anthropic Reduce hallucinations — https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations (B)
- R v Andrewes [2022] UKSC 24 — https://supremecourt.uk/press-summary/uksc-2020-0166.html (A)
- Laszlo Bock X-Y-Z — https://www.businessinsider.in/Googles-former-HR-boss-says-this-is-the-key-to-a-perfect-resume/articleshow/54925993.cms (C)
- University of Sheffield Careers — https://sheffield.ac.uk/careers/support/apply/cv/writing (C)

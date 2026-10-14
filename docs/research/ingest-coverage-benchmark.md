# Ingest coverage benchmark (2026-10-14)

Question: of the employers UK students target most, how many does our seed list (`seed/companies.yml`) reach? For those it misses, why?

- Benchmark: `seed/coverage-benchmark.yml`, 159 employers hand-curated by sector. Banks and IB 28, trading 19, asset management and insurance 10, consulting 18, Big 4 and accounting 7, law 15, FMCG and retail 21, big tech 31, industry, energy and pharma 10. It is a yardstick, not a seed list.
- Tool: `npm run coverage`. Add `-- --live` to fetch every board and count postings kept by the real ingest filters. Add `--gaps` for the gap list, and `--companies <yml>` to measure another seed list. Nothing is written to the DB.
- **Configured**: the employer has at least one enabled board in companies.yml.
- **Live (UK/EU)**: that board has at least one early-career posting today that passes `passesTitleFilter` and `passesLocationFilter`. **Live (UK)**: at least one such posting is in London or elsewhere in the UK.

## Results

Before: `feat/placed-build` at 88be367, measured with its own code and filters. After: this branch.

| sector | employers | configured before → after | live UK/EU before → after | live UK before → after |
|---|---:|---:|---:|---:|
| banks and IB | 28 | 7 → 11 | 6 → 10 | 4 → 6 |
| trading | 19 | 7 → 10 | 7 → 10 | 5 → 8 |
| asset mgmt / insurance | 10 | 2 → 7 | 2 → 6 | 2 → 4 |
| consulting | 18 | 2 → 7 | 2 → 7 | 2 → 5 |
| Big 4 / accounting | 7 | 1 → 2 | 1 → 2 | 0 → 0 |
| law | 15 | 1 → 6 | 1 → 5 | 1 → 2 |
| FMCG / retail | 21 | 0 → 6 | 0 → 4 | 0 → 3 |
| big tech | 31 | 8 → 17 | 6 → 15 | 5 → 10 |
| industry / pharma | 10 | 2 → 5 | 2 → 3 | 2 → 2 |
| **all** | **159** | **30 → 71 (19% → 45%)** | **27 → 62 (17% → 39%)** | **21 → 40 (13% → 25%)** |

Postings kept on the benchmark employers' boards went from 378 to 869 (UK: 179 to 313). The "before" figure is inflated by false positives that this branch removes (see Filter fixes).

Biggest UK gains: Lloyds (0 → 57 UK), P&G (20 UK), Oliver Wyman / Marsh McLennan (7), NatWest (5), PIMCO (7), Brevan Howard (5), Qube (6), HRT (4), Squarepoint (3), Mars (6), Mondelez (3), Cisco (3).

## What was wrong, and the cheap fixes

| Problem | Employers | Fix |
|---|---|---|
| Wrong Workday site seeded | Lloyds (LBG_Careers has no student roles, so it was disabled), PwC (experienced site only) | Added `lbg/undergraduate_careers`, `lbg/graduate_careers` and `pwc/Global_Campus_Careers` (83 roles, no overlap with the experienced site) |
| Workday tenant has an unexpected name | NatWest (`rbs`), Mondelez (`mdlz`), BP (`bpinternational`), Oliver Wyman (`mmc`, Marsh McLennan), P&G (`pg/1000`) | Tenant and site found by probing the cxs API: unknown tenant → 422, wrong site → 404 |
| Workday, simply not seeded | Santander, Mizuho, Brevan Howard, PIMCO, S&P, M&G, Aviva, Mastercard, Visa, Accenture, Linklaters, NRF, Hogan Lovells, White & Case, Unilever, Mars, Diageo, Salesforce, NVIDIA, Intel, Cisco, Adobe, Sky, AstraZeneca, Rolls-Royce | Added (about 30 tenants). Several were already in career-ops `portals.yml` |
| Greenhouse board with a non-obvious slug | HRT (`wehrtyou`), Qube, Squarepoint, Ocado, Forvis Mazars DE | Added |
| **Wrong company** | `greenhouse/wise` is "Wise Worksite Field Sales" (US sales agents), not Wise the fintech | Disabled; the real Wise board is SmartRecruiters |
| ATS not supported | Clifford Chance, Roland Berger, PA Consulting, Legal & General, Forvis Mazars, ASOS, Wise (all on SmartRecruiters) | New `smartrecruiters` provider using the public Posting API. Needs migration `0011_smartrecruiters.sql` (written, **not applied**) |

## Filter fixes (precision; found while auditing the new boards, then corrected after review)

- `"Placement"` was a substring match, so "12 months **replacement**" counted as a placement. It now needs a word start. Insurance-broking titles ("Placement Specialist") and experienced grades ("Analyst II", "Software Engineer III") are excluded. A bare numeral ("Intern II", "Phase II") is still fine.
- Remote flag leaks:
  - Workday's `remoteType` "This position is **not** available for remote working" was read as remote (`isRemoteType`).
  - Any remote-flagged role passed, even one in San Francisco, Costa Rica or Malaysia, and so did "Remote - US". Now a role passes if its place is in the UK or Europe. Otherwise it fails if it names a place on the (extended) non-UK/EU block list. Only then do a remote flag or remote text let it through.
  - Unnamed places ("Hybrid", "Multiple Locations") with a remote flag still pass. This drops 7 of the 190 snapshot jobs (Ashby roles in San Francisco and New York).
- "London, Canada" / "London, ON" (BDO Canada) is no longer London. This applies only at the end of a segment, so "London, Canada Square" and "London, On-site" stay London.
- Locations are classified per segment (split on `;`, `|`, `/`, "or"), so "Edinburgh; New York" is still UK. In a segment, a UK city name followed by a US, AU or CA state code, or next to a blocked place ("Cambridge, MA", "Newcastle, NSW", "Manchester, Toronto"), is not UK unless the segment also says UK, England, etc.
- Recall: more UK cities (Sheffield, Newcastle, Liverpool, Nottingham, Southampton…) and EU countries (Luxembourg, Norway, Finland, Czechia, Greece, Romania, Hungary, the Baltics…) are now recognised.
- Roles for staff who run programmes ("Early Careers Programme Coordinator", "Emerging Talent Delivery Team Manager") are now excluded.

## Other fixes

- **Feed cap:** `getLiveJobs` returned at most 500 live jobs (newest first). With this seed list there are well over 1,000 live postings, so the oldest would never have been ranked. It now pages in 1,000-row chunks, up to 5,000.
- **HTTP retries:** timeouts and connection resets are now retried like 429/5xx. GSK, P&G and Marsh boards were failing intermittently. Other errors (DNS, a bad host) fail immediately.
- **SmartRecruiters partial listings:** a listing without `totalFound`, or a board over the cap, fails the board instead of returning a partial list (which `markDead` would treat as closures). If fewer unique ids come back than `totalFound`, page 0 is fetched again. The run is accepted only if the board really shrank (a posting closed mid-run). Known gap: an unknown slug returns 200 with `totalFound: 0`.
- **Tailoring verifier:** the new seed companies had to join `KNOWN_EMPLOYERS` (a test enforces it). Ordinary-word employers (Visa, Intel, Sky, also the existing Apple and Shell) at the start of a sentence no longer block the CV's own lowercase word ("visa applications" → "Visa applications…"), only when the word plus the next word appear together in the CV and no punctuation follows the name. So "apple pie" on the CV doesn't excuse "Apple: built…" or "Apple engineers…". Affiliation claims ("Interned at Visa") always block.
- **Seeding:** `seed.ts` upserts companies one ATS at a time. If an ATS fails the check constraint (migration not applied), only that group is skipped and the exit code is 1; any other error throws.

## What's still missing (88 employers) and why

| Reason | n | Employers (examples) | Cost to fix |
|---|---:|---|---|
| Own careers site, no public feed (or ATS not identified) | 56 | Goldman Sachs, HSBC, UBS, BNP, Jane Street, Citadel, Optiver, McKinsey, Bain, EY, KPMG, Magic Circle and US law firms, Google, Microsoft, Meta, Apple, Tesco, Sainsbury's, Revolut | High: per-site work, or hand-curated programme rows |
| Oleeo / tal.net | 6 | Bank of America, Nomura, Jefferies, Bank of England, Fidelity Intl, L.E.K. | HTML job boards; would mean scraping. Not done |
| Oracle Recruiting Cloud | 5 | **JPMorgan**, Lazard, Schroders, M&S, Oracle | Medium: one provider over the public `recruitingCEJobRequisitions` REST API, plus a migration. Best next step (JPMorgan) |
| SAP SuccessFactors | 4 | Reckitt, BAT, Heineken, JLR | Medium to high |
| Workday, board exists but no UK/EU roles (or site name unknown) | 4 | RBC, Macquarie (`mq` tenant, site not found), BDO UK, DLA Piper (US tenant) | Low if the site name is found |
| Eightfold / iCIMS / Avature / Taleo / Phenom | 10 | Millennium, Haleon, Qualcomm, SIG, PepsiCo, Arm, Deloitte, Bloomberg, SocGen, BCG | Medium to high, provider by provider |
| Board has no early-career roles | 2 | XTX Markets, AB InBev | n/a |
| amazon.jobs JSON | 1 | Amazon | Low to medium: one provider |

Big 4 stays weak for UK roles: PwC UK, Deloitte, EY and KPMG don't put UK student roles on a board we can read. Workday `pwc/Global_Campus_Careers` is non-UK PwC firms only.

Not fixed (follow-ups): a hung host can still cost about 72s per request (4 × 15s timeouts plus backoff) before the board fails. The feed now loads up to 5,000 live rows (with `text_lines`) in up to 5 round trips; if that gets slow, move ranking inputs to a slimmer select. jobs already live in the DB for a board that is now disabled (`greenhouse/wise`) stay live, because ingest only visits enabled companies. None of that board's titles passed the title filter in the snapshot. The same posting on two sites of one tenant becomes two rows (checked: none for PwC; not checked for Lloyds).

Configured but 0 live UK/EU early-career roles today: Morgan Stanley (no campus roles open yet), Legal & General, NRF, Diageo, ASOS, Spotify, Wise, BP, Rolls-Royce. These are seasonal; the boards stay enabled.

## Method and constraints

- Only public job-board APIs: Greenhouse, Lever and Ashby boards; SmartRecruiters Posting API; Workday's candidate-site cxs JSON (already used in production). One GET per employer careers page to fingerprint the ATS from its links. No login, no HTML scraping of job boards, no CAPTCHA or bot-wall bypass. Sites that answered 403 were left alone.
- Probing used a few slug variants per employer and, for Workday, about 15 requests per tenant, sequential with small delays.
- Counts are a 2026-10-14 snapshot. Early-careers boards are seasonal, so re-run `npm run coverage -- --live` before quoting numbers.

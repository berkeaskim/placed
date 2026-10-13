# Ingest coverage & date accuracy (2026-10-13)

Goal: catch as many UK-relevant internships as possible, with opening/closing dates we can defend, and **no LLM in the inclusion or date path**.

## Where we are today

- 90 companies in `seed/companies.yml`, only Greenhouse (55) / Ashby (30) / Lever (6).
- Snapshot: 190 jobs (160 internship, 8 graduate, 6 placement, 3 spring week, 2 insight).
- Inclusion is already deterministic: `passesTitleFilter` + `passesLocationFilter` (regex). The LLM (`tagJob`) only enriches; it never decides whether a job is in the feed. Keep it that way.
- **Deadline is set on 10/190 jobs (5%).** Opening date comes from the ATS (`first_published` / `publishedAt` / `createdAt`).
- Biggest hole: the employers UK students target most (banks, Big 4, large corporates) aren't on Greenhouse/Lever/Ashby, so we have none of them.

## Sources, verified live today

| Source | Endpoint | Who's on it (verified) | Open date | Close date |
|---|---|---|---|---|
| Greenhouse | `boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true` | in use | `first_published` | none in API; JD text only |
| Lever | `api.lever.co/v0/postings/{slug}?mode=json` | in use | `createdAt` | none |
| Ashby | `api.ashbyhq.com/posting-api/job-board/{slug}` | in use | `publishedAt` | none |
| **Workday** | `POST {t}.{wdN}.myworkdayjobs.com/wday/cxs/{t}/{site}/jobs` + `GET .../wday/cxs/{t}/{site}{externalPath}` | Barclays (661), Citi, Morgan Stanley, Deutsche Bank, Lloyds, PwC, RBC, BlackRock | detail `startDate`, page JSON-LD `datePosted` | **page JSON-LD `validThrough`** (exact date), detail `timeLeftToApply` |
| **Oracle Recruiting Cloud** | `{host}.fa.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?finder=findReqs;siteNumber=...` | JPMorgan (332 hits for "summer analyst") | `PostedDate`, `ExternalPostedStartDate` | `ExternalPostedEndDate` (when the employer sets it) |
| Recruitee | `{slug}.recruitee.com/api/offers/` | e.g. bunq | `published_at` | none |
| SmartRecruiters | `api.smartrecruiters.com/v1/companies/{id}/postings` | public, no key | `releasedDate` | none |
| Amazon | `amazon.jobs/en/search.json?base_query=intern&loc_query=London` | Amazon (429 intern hits) | `posted_date` | none |

Notes:
- Workday's `searchText` ranks results; it doesn't filter them. Page through everything (or use the facets) and run our own title filter.
- Any job page with schema.org `JobPosting` JSON-LD (`datePosted`, `validThrough`) gives exact dates without an LLM. Greenhouse's hosted pages don't include it (checked). Workday's do.
- Not yet tackled (custom or hard): Goldman Sachs (higher.gs.com, custom), Oleeo/tal.net (law firms, civil service, Bank of England), Avature (Bloomberg, Deloitte). For the hackathon, add these as hand-curated programme rows.

## Date accuracy: how we get each date

Order of precedence, each stored with a `deadline_source`:

1. Structured ATS field: Workday JSON-LD `validThrough`, Oracle `ExternalPostedEndDate`. **Exact.**
2. JD text regex. The current regex misses formats that really occur in our data, such as `Closing Date: 1st of November 2026` and `Application deadline: 16/10/2026` (UK dd/mm). Add the ordinal "of", numeric dd/mm/yyyy (UK order) and "by 31 October" with year inference.
3. A "rolling" phrase detected → `deadline = null`, `rolling = true`. Show it as "Rolling, apply early", not as "no deadline".
4. Nothing found → `null`. Never guess.

Observed closure: if a job isn't in the feed on a run, set `closed_at` to that run's time (`markDead` already detects this). This is the ground-truth close date for the 90%+ of ATS jobs that don't publish one, and over cycles it lets us predict when the next one opens.

Opening date = `min(ATS posted date, first_seen)`. Don't fall back to Greenhouse `updated_at`; that's an edit time, not an opening date.

Honest expectation: for Greenhouse, Lever and Ashby, most postings never state a deadline (only ~12 of 190 have a date anywhere in the text: 10 caught, 2 missed). Exact close dates will mostly come from Workday/Oracle (banks) plus observed closure.

## Recall: how we find more companies (deterministic)

1. **Seed expansion from employer lists:** Times Top 100 Graduate Employers, RateMyPlacement Top 100, ISE members, Gradcracker employers. Fetch each careers page and fingerprint the ATS with a regex on outbound links (`myworkdayjobs.com`, `greenhouse.io`, `lever.co`, `ashbyhq.com`, `fa.oraclecloud.com`, `smartrecruiters.com`, `recruitee.com`, `tal.net`, `avature.net`). Output: `companies.yml` rows. No LLM.
2. **Common Crawl CDX:** enumerate every `job-boards.greenhouse.io/{slug}` (verified: 254 boards from one 5k-row page), Workday tenants, Lever and Ashby slugs. Hit each board API and keep only boards with a UK-located title-filter match. The index is flaky (502/504s), so run it offline as a one-time batch.
3. **Keyed aggregator APIs as a long-tail safety net:** Adzuna and Reed (free UK keys). Deduplicate against ATS jobs with `jobFingerprint`.
4. **Recall benchmark:** a hand-made list of about 30 known UK 2027 programmes (spring weeks, summer analyst, placements). Coverage = % found. This number goes in the pitch.

## Build order (by Friday)

1. Workday provider (list + detail + JSON-LD dates) and seed the bank tenants above.
2. Deadline extractor v2 with `deadline_source` and `rolling`; `closed_at` on markDead; `opened_at`.
3. Oracle provider (JPMorgan).
4. ATS fingerprint script → expand `companies.yml`.
5. Recall benchmark + coverage number in the UI or pitch.
6. (If time) SmartRecruiters/Recruitee/Amazon, Adzuna.

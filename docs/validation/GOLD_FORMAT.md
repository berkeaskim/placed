# Gold set format: `placed-gold/1`

A gold file holds CVs that people have labelled rule by rule. `npm run validate:cv` compares Placed's checks against those labels. The loader is `lib/cv-score/gold.ts`. It rejects any file that breaks the rules below and lists every problem it finds.

The only gold file in the repo is `gold/synthetic-example.json`. Its CVs and labels are **made up**, and it exists so the harness and its tests can run in CI. Real gold files hold real students' CVs, so keep them out of the public repo (see "Privacy" below).

## File

```json
{
  "format": "placed-gold/1",
  "name": "ucl-careers-2027-batch-1",
  "synthetic": false,
  "description": "What this set is, who labelled it and when.",
  "created": "2027-01-20",
  "rulesVersion": "r-…",
  "raters": [
    { "id": "CA1", "role": "UCL careers adviser" },
    { "id": "CA2", "role": "UCL careers adviser" },
    { "id": "RC1", "role": "early-careers recruiter, investment bank" }
  ],
  "cvs": [ … ]
}
```

| Field | Rule |
|---|---|
| `format` | Exactly `placed-gold/1`. A breaking change to this format means a new version string. |
| `synthetic` | `true` for made-up data, `false` for real CVs. A synthetic file may not list a rater with `"synthetic": false`. |
| `created` | `YYYY-MM-DD`, the date labelling finished. |
| `rulesVersion` | Optional. The `RULES_VERSION` (`lib/cv-score/cache.ts`) the raters saw. Rule wording changes over time, so record it. |
| `raters` | At least 2. `id` is a short code (letters, digits, `-`, `_`, up to 32 characters), **never a name**. `role` describes the rater's expertise. Keep the code-to-person key outside the repo. |

## CV entry

```json
{
  "id": "cv-017",
  "sector": "finance_banking",
  "year": "penultimate",
  "track": "standard",
  "pageCount": 1,
  "text": "[NAME]\nalex.taylor@example.com | 07700 900456\n\nEDUCATION\n…",
  "notes": "Optional free text: why this CV is in the set.",
  "labels": {
    "CA1": { "G-17": "pass", "G-20": "partial", "G-22": "fail" },
    "CA2": { "G-17": "pass", "G-20": "fail", "G-22": "fail" },
    "RC1": { "G-17": "pass", "G-20": "pass", "G-22": "fail" }
  }
}
```

| Field | Rule |
|---|---|
| `sector` | One of `software_eng`, `data_analytics`, `quant_trading`, `consulting`, `product`, `finance_banking`, `marketing_growth`, `research`. |
| `year` | `1st`, `2nd`, `penultimate`, `final` or `masters`. |
| `track` | `standard` (default) or `spring`. |
| `pageCount` | Pages in the original PDF (default 1). The page-length rule uses it. |
| `text` | The redacted text layer of the CV (see "Redaction protocol"). At least 50 characters. |
| `labels` | `labels[raterId][ruleId]`. At least 2 raters per CV, and every rater must be listed in `raters`. A rater may skip rules. |

**Label values:** `pass`, `fail`, `na` (the rule doesn't apply to this CV), or `partial`. Use `partial` only for rules with `allowPartial` (the loader rejects it elsewhere). For agreement statistics, `partial` counts as `fail`, because the fix is still worth doing.

Every rule id must exist and be scored for the CV's sector and track (`rulesFor(sector, track)`). Raters label from the same rule wording, question and pass/fail examples that the AI judge sees, so check `rulesVersion`.

## How labels become ground truth

The **consensus** for a rule on a CV is the strict majority of the binary labels (pass / fail / na). A tie, or fewer than 2 labels, has no consensus, and that item is left out of the machine-vs-human numbers. This means 3 raters work much better than 2: with 2 raters, every disagreement is lost.

If your process adjudicates disagreements, you can add an adjudicated label as an extra rater with id `ADJ`. That rater then outvotes a 1–1 split. Say you did this in `description`.

## Redaction protocol (real CVs)

Before a CV goes into a gold file:

1. Get the student's written consent for the CV to be used to test Placed.
2. Replace the candidate's name everywhere with `[NAME]`. Replace referees' names with `[REFEREE NAME]` and co-authors' names with `[AUTHOR]`.
3. Replace the email with a fictitious `firstname.lastname@example.com`, and the phone number with an Ofcom drama number (`07700 900000`–`07700 900999`). Keep both lines in the same place and format. This keeps the contact-details checks meaningful without revealing anyone.
4. Drop street addresses. Keep a town or city.
5. Replace profile URLs with `github.com/example-<word>` or `linkedin.com/in/example-<word>`. Keep the platform, because rules check for it.
6. Keep universities, schools, employers, grades, dates and everything else. Rules depend on them.
7. Remove anything that identifies the student indirectly and isn't needed by a rule, such as a unique award or a named small employer. When in doubt, generalise it.

## Privacy

Real gold files are personal data, even after redaction. Store them outside this public repository, for example in a private folder, and point the script at them:

```sh
npm run validate:cv -- --gold ~/placed-gold/batch-1.json
```

Reports contain only rule ids and statistics, so they can be committed.

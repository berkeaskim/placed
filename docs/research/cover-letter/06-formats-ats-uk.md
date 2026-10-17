# 06 — Formats, application systems and UK conventions

Researcher angle: the shapes a "cover letter" takes in practice, how ATSs ingest them, UK letter conventions, sensitive disclosures, and length adaptation. Written to drive Placed's AI cover-letter writer and the Autopilot auto-fill extension.

Research date: 2026-10-17. Source IDs `[S#]` refer to section 7. Confidence tags: **[official]** = vendor docs / gov / university careers service; **[secondary]** = third-party guide or vendor blog, treat as unverified.

---

## 1. Format taxonomy

| # | Format | Where it appears | Length limit (typical) | What changes in the writing |
|---|---|---|---|---|
| F1 | **Uploaded letter file (PDF/DOCX)** | Greenhouse "Attach" [S1][S2], Lever, Workday "My Experience" attachments [S9], SuccessFactors [S11], Indeed [S13], Avature/generic portals (optional "Add Cover Letter" step) [S14] | One side of A4, ~250–400 words [S5][S6][S7]; Workday uploads seen capped at 5 MB [S9] | Full letter format: sender block, date, (employer address), salutation, Ref line, 3–5 paragraphs, sign-off. PDF unless advert says otherwise [S6][S7]. Must match CV font/style [S5][S7]. |
| F2 | **Pasted plain-text box (letter-shaped)** | Greenhouse "Enter manually" = API field `cover_letter_text` [S1][S2]; Indeed text box [S13]; Lever's free-text "Additional information" box often acts as the de facto letter [S12, secondary] | Usually unstated; employer-configured. Treat as ≤ 3,000 chars unless shown | Drop address block, date and letterhead (no layout survives plain text). Keep salutation + sign-off. No bullets/bold/markdown; short paragraphs separated by blank lines. Text boxes are fully searchable whereas PDF parsing varies [S15, secondary]. |
| F3 | **Motivational / screening question** ("Why this role?", "Why us?", "Why this division?") | Workday supplemental questions, Ashby long-answer fields [S10], SuccessFactors/Taleo/Avature questionnaires; banks and Big 4 that replace letters with questions [S16][S17] | Employer-set: 100/150/200/250/300/500 words or 1,000–4,000 characters. Write close to, never over, the limit, e.g. at least 200 if limit is 250 [S18][S19] | No salutation, no sign-off, no "I am writing to apply". First sentence answers the question directly. One question = one job (don't answer "why you" in a "why us" box). Mirror question wording. |
| F4 | **Email body (direct application)** | Small firms, startups, boutique funds, academic labs, referrals | Shorter than a letter: ~150–250 words | Subject line = job title + reference code [S8]. Either the email *is* the letter, or a brief email plus attached letter; never duplicate content in both [S5][S7]. Prospects prefers body text over attachment to avoid spam filters [S6]. No "I hope this email finds you well" [S5]. |
| F5 | **Speculative letter** (no advertised vacancy) | Email or LinkedIn to SMEs, boutiques, start-ups, research groups | One page / ~200–300 words | State year of study and what you're looking for (e.g. 10-week summer internship) [S20]; heavier research and "why you" weight because there is no JD [S21][S22]; target only firms that welcome it [S21]; follow up after ~2 weeks [S6][S23]. |
| F6 | **Networking / warm-intro note** | LinkedIn message, alumni email, post-event follow-up | 50–120 words (LinkedIn connection note ~300 chars) | Reference the shared context first (event, alumnus, mutual). Ask for a conversation, not a job. Use "Yours sincerely"/"Kind regards" since there is prior contact [S4]. |
| F7 | **No letter accepted** | e.g. PwC UK graduate form: single online form, no CV or covering-letter upload [S17]; many banks use motivation questions instead [S16] | n/a | Generator must route motivation content into F3 answers instead. Don't upload a letter into an unrelated "Other documents" slot unless invited. |

### How ATSs store cover letters (what the extension must know)

- **Greenhouse** accepts the letter four ways: multipart file `cover_letter`, base64 `cover_letter_content` + filename, remote `cover_letter_url` + filename, or plain `cover_letter_text` [S2, official]. Live forms show "Attach / Dropbox / Google Drive / Enter manually" with accepted types pdf, doc, docx, txt, rtf; some employers mark it required [S1].
- **Lever** application submissions include resumes and cover letters; accepted uploads .docx, .doc, .pdf, .txt and images [S12a, secondary].
- **SAP SuccessFactors** accepts Word, PDF, image and text for resume/cover-letter uploads; admins cannot restrict types. Gotcha: an application's cover letter only syncs to the candidate profile if the profile already has one [S11, official SAP KBAs].
- **Workday**: upload area at the bottom of "My Experience"; PDF recommended; per-file 5 MB cap observed [S9]. Text-question limits are employer-configured (no global default found).
- **Ashby**: forms built from field types incl. short answer and long answer; files can be categorised, cover letter is one category [S10, official].
- **Oracle Taleo**: no primary docs found. A third-party test reports Taleo often merges the cover letter with the resume into one PDF and scores the combined tokens [S15, secondary, unverified].
- **Keywords**: secondary tests say Greenhouse and Lever parse and index letter text; Lever shows it in its own tab and doesn't score it against the JD; Greenhouse JD-scoring of letters is an optional admin setting [S15]. Conclusion: **keywords help searchability marginally; the CV must carry the must-have keywords**; the letter should use JD vocabulary naturally, not stuff it.

---

## 2. UK conventions checklist

| ✔ | Convention | Rule | Sources |
|---|---|---|---|
| ☐ | Paper | A4, one side maximum unless told otherwise | [S6][S7][S8] |
| ☐ | Length | ~250–400 words; 3–5 short paragraphs; stated word counts override the one-page default | [S6][S7][S8] |
| ☐ | Font | Arial / Calibri / Times New Roman, 10–12 pt; match the CV | [S5][S7][S24] |
| ☐ | Spelling | British English consistently for UK applications (organisation, programme, analyse, -ise) | [S7] |
| ☐ | Sender block | Your contact details at top (UK templates often still show full address; for students, name + phone + email + LinkedIn is enough on upload). | [S4][S5][S7] |
| ☐ | Employer address | Include if known (Manchester and St Andrews templates show it); omit in text boxes and email | [S4][S7] |
| ☐ | Date | Include under addresses; UK format `17 October 2026` (day-month-year, no ordinal comma). Never US `October 17, 2026` or `10/17/2026` | [S4][S5] (format: UK convention) |
| ☐ | Reference line | Bold "Ref:" + job title / vacancy ID before or after salutation; email subject = title + ref | [S4][S8][S7] |
| ☐ | Salutation, named | "Dear Ms Patel" / "Dear Dr Jones" — title + surname, no full stop after Mr/Ms/Dr (UK style) | [S3][S24] |
| ☐ | Salutation, unnamed | Last resort, after researching: "Dear Hiring Manager", "Dear Recruitment Team", or "Dear Sir or Madam" | [S4][S6][S24] |
| ☐ | Sign-off pairing | Named person → **Yours sincerely**. Unnamed ("Dear Sir or Madam"/"Dear Hiring Manager") → **Yours faithfully**. Prior contact (met at event) → Yours sincerely | [S3][S4][S5][S6][S7] |
| ☐ | Email sign-off | "Kind regards" is the norm in email/LinkedIn (no careers-service source mandates it; it is UK business convention). Keep Yours sincerely/faithfully for formal letters | (convention, see open Q) |
| ☐ | Capitalisation | Only first word capitalised: "Yours sincerely", not "Yours Sincerely" | UK convention |
| ☐ | File format | PDF unless the advert specifies otherwise | [S5][S6] |
| ☐ | File name | Include your name, company and date, e.g. `Berke-Askim_Cover-Letter_Goldman-Sachs_2026-10.pdf` | [S5] |
| ☐ | Tone avoid-list | No "I hereby apply", no "I hope this email finds you well", no "fast learner"/"give 100%" | [S5] |
| ☐ | Opening content | Role title, where you saw it, (for internships) availability dates | [S6][S7] |
| ☐ | Close | Restate interest, request interview, thanks; note unavailable dates if relevant | [S5][S6] |
| ☐ | Salary | Only if asked | [S6] |
| ☐ | Finding a name | Advert → company website → LinkedIn → web search → phone the organisation | [S5][S6][S24] |
| ☐ | Follow-up | No reply after two weeks → short email to confirm receipt | [S6][S23] |

**UK vs US quick diff (for prompt guards):** US letters put date first and use "Sincerely,"; UK uses Yours sincerely/faithfully pairing, en-GB spelling, A4 not Letter, DD Month YYYY dates, no comma after "Dear X" is acceptable in UK (either is fine; be consistent). "Résumé" → "CV". "Program" → "programme" (except computer program). "Junior/senior year" → "second/final year".

### What UK careers services say (target unis)

- **UCL**: guidance lives in Career Discovery / myUCLCareers (login); UCL guides cover multiple application formats and have a dedicated cover letters guide [S25]. Page was 403 to fetchers; no rules extracted directly.
- **LSE**: speculative letters: be strategic about organisations that welcome them, research sector and competitors, one dedicated letter per organisation, more weight on the letter to sell you [S21][S22].
- **KCL**: points students to CareerSet for automated CV/cover-letter checks and to consultant appointments [S26]. No public rule text.
- **Imperial**: CVs, Cover Letters and Personal Statements booklet with UG/Masters/PhD examples [S27]; no public one-page rule found.
- **Oxford**: draft first, then get adviser feedback; annual Oxford Guide to Careers has a cover-letter section [S28] (page itself 403).
- **Cambridge**: downloadable guides; explicitly "designed to help you to write CVs for use in the UK", other countries may need a very different style [S29]; CareerSet for feedback.
- **Manchester**: template = your address, company address, date, "Dear recruiter/recruitment team" or name, bold Ref line, intro → why company → why job → why you; Yours faithfully/sincerely pairing; Yours sincerely if you met them at an event [S4].
- Others used as corroboration: Nottingham [S5], St Andrews [S7], Salford [S8], Staffordshire/Aberystwyth/Brunel [S3].

Placed implication: since `university` is now configurable (PR #28/#34), the app can surface "Get this checked by <your careers service>" with CareerSet for KCL/Cambridge.

---

## 3. Sensitive topics

### 3a. Visa / right to work (international students)

Facts (verify at runtime, these change):
- Graduate visa: 2 years for applications made by 31 Dec 2026; **18 months for applications from 1 Jan 2027**; 3 years for PhD. No sponsor or job offer required; can "work in most jobs" [S30, official GOV.UK].
- Employers need no sponsor licence to hire a Graduate-visa holder, but must still do a right-to-work check (share code + date of birth) [S31][S32, secondary law-firm guides].
- Skilled Worker route needs a licensed sponsor; Graduate permission can't normally be extended [S31].
- Some employers still hesitate because Graduate permission is time-limited [S33].

Guidance:
- Cardiff's international-student template includes an **optional** right-to-work paragraph stating the Graduate visa needs no sponsorship and the candidate could later move to Skilled Worker with a sponsoring employer [S34].
- Careers services aren't authorised to give visa advice; point to GOV.UK, don't make legal claims [S35].
- Put it in **one or two sentences near the end**, after the value case; never lead with it.
- For internships/spring weeks during study: Student visa holders have term-time hour caps; full-time work typically only in official vacation. Placed should check internship dates vs vacation before generating a "I'm available full-time" claim (see open questions).
- If the form has a dedicated sponsorship/right-to-work question, answer it **there**, truthfully, and omit it from the letter to save words.

### 3b. Disability, health and adjustments

- Disclosure is optional and the applicant's decision, when and how [S5][S36].
- Equality Act 2010 s.60 generally makes it unlawful for employers to ask health/disability questions before a job offer; adjustments duty still applies throughout recruitment [S37, official EHRC].
- If disclosing, keep it short and factual, link to skills/strengths, don't let it dominate; no need to name a condition [S36][S38].
- **Disability Confident** guaranteed-interview schemes require meeting the stated essential criteria, and some employers ask the letter to show how you meet named criteria [S39]. If the user opts in, the letter must explicitly evidence each essential criterion.
- Interview adjustments: request them via the form's adjustments field or recruiter email, not in the persuasive letter body.

### 3c. Gaps

- Be open and honest, be ready to explain, focus on transferable skills [S40, National Careers Service].
- Place a gap explanation in the 3rd/4th paragraph: what you did and what you learned, then return to enthusiasm [S41, Prospects].
- Health-related gaps: brief; no detail required [S42].
- For students, most "gaps" are gap years / interrupted study; one clause is usually enough.

### 3d. Grades

- No careers-service source found on predicted grades / mitigating circumstances in a letter (gap). Working rule: grades belong on the CV and in the form's education fields; in the letter, mention a grade only if it's a selling point (First / high 2:1, top-x% module), and handle mitigating circumstances in a single neutral sentence only if the employer has a hard 2:1 cut-off the user misses. Flag for user review.

---

## 4. Length-adaptation recipe (full letter → 250 → 150 words)

Start from the master letter (≈300–400 words, 4–5 paragraphs): Opening (role, source, availability) · Why this work · Why this employer · Why me (2–3 evidenced examples) · Close.

**Step 0 — classify the box.** Read the label: is it "cover letter" (letter-shaped), or a specific question ("Why X?", "Why you?")? Read the limit unit (words vs characters; for chars assume ~6 chars/word incl. space). Target 85–100% of the limit [S18][S19].

**→ ~250 words (pasted letter or "Why this role and firm?")**
1. Delete: address block, date, Ref line, "I am writing to apply…", repeated CV content, closing pleasantries beyond one sentence.
2. Merge "why this work" + "why this employer" into one paragraph with **two firm-specific hooks** (a deal/product/team/value, not website boilerplate [S7]).
3. Keep **two** evidence examples, each as one sentence in claim → action → result form with a number.
4. One-sentence close tying back to the role.
5. If it's a question box: remove salutation/sign-off; first sentence answers the question in the question's own words.

**→ ~150 words ("Why us?" / "Why this role?")**
1. Structure: 1 sentence direct answer → 1 firm hook with specific evidence → 1 personal link (experience that proves the interest) → 1 forward-looking sentence on what you'd contribute/learn.
2. Keep **one** evidence example; keep **one** firm-specific fact.
3. No adjectives without proof; no list of three generic values.
4. Answer only the question asked; push "why you" content into the competency boxes.

**→ ≤ 100 words / ≤ 600 chars**: single paragraph, 3 sentences: answer + hook + proof.

Hard checks after every cut: under limit (count the way the form counts; Workday/others may count characters including spaces and newlines), firm name correct, role title exact, en-GB spelling, no placeholder text, no orphaned references ("as mentioned above").

---

## 5. Candidate rules

| ID | Rule | Why | Severity | Machine-checkable? |
|---|---|---|---|---|
| CL-FM-01 | Detect target format (F1–F7) from the form field before generating; never paste a full letter into a question box | Formats differ in structure; question boxes penalise letter boilerplate | High | Yes (field label/type/limit heuristics) |
| CL-FM-02 | Never exceed a stated word/char limit; aim for 85–100% of it | Over-limit text is truncated or rejected; well under looks low-effort [S18][S19] | Critical | Yes |
| CL-FM-03 | Count characters including spaces and newlines when the limit is in characters | Forms count raw chars | High | Yes |
| CL-FM-04 | Uploaded letters: one A4 page, ≤ 400 words, 3–5 paragraphs | UK careers consensus [S6][S7][S8] | High | Yes (word count; page count on render) |
| CL-FM-05 | Uploaded letters export as PDF unless the advert asks for DOCX | Cross-platform fidelity [S5][S6] | Medium | Yes |
| CL-FM-06 | File name pattern `{First}-{Last}_Cover-Letter_{Company}_{YYYY-MM}.pdf`; no spaces, no "final_v3" | Name+company+date advised [S5]; recruiters download many files | Medium | Yes (regex) |
| CL-FM-07 | Font matches CV; Arial/Calibri/Times 10–12 pt | [S5][S7] | Low | Yes (render template) |
| CL-FM-08 | Plain-text boxes: strip address/date/letterhead, markdown, bullets, smart formatting; paragraphs separated by one blank line | Layout doesn't survive; text is indexed | High | Yes |
| CL-FM-09 | Question boxes: no salutation, no sign-off, first sentence answers the question using its key nouns | Graders scan for a direct answer | High | Yes (starts with "Dear"/ends with "Yours" → fail) |
| CL-FM-10 | Salutation/sign-off pairing: named → "Yours sincerely"; unnamed → "Yours faithfully"; email/LinkedIn → "Kind regards" | Universal UK careers rule [S3]–[S7] | High | Yes |
| CL-FM-11 | Named salutation = "Dear {Title} {Surname}" with no full stop after Mr/Ms/Dr; never first name only unless prior contact; never "To whom it may concern" | UK formality [S3][S24] | Medium | Yes |
| CL-FM-12 | Unnamed default order: "Dear Hiring Manager" → "Dear {Team} Recruitment Team" → "Dear Sir or Madam"; prompt user to find a name first (advert, site, LinkedIn, phone) | Named letters preferred; generic is last resort [S6][S24] | Medium | Partly (flag when no name) |
| CL-FM-13 | Dates in UK format `D Month YYYY` | UK convention; US formats signal a template | Medium | Yes (regex) |
| CL-FM-14 | Enforce en-GB spelling (organisation, programme, analyse, centre, behaviour, CV not résumé) for UK roles | [S7] | High | Yes (spell-list) |
| CL-FM-15 | Include the exact job title and any reference ID in the opening or Ref line; email subject = title + ref | Employers recruit several posts at once [S4][S8] | High | Yes (string match vs job record) |
| CL-FM-16 | Opening states role, where seen, and availability dates for internships | [S6][S7] | Medium | Partly |
| CL-FM-17 | Email applications: either body-as-letter or short email + attachments; never duplicate the letter in both | [S5][S7] | Medium | Yes (similarity check) |
| CL-FM-18 | Ban phrases: "I hereby apply", "I hope this email finds you well", "To whom it may concern", "fast learner", "give 100%" | Flagged by careers services [S5] | Medium | Yes |
| CL-FM-19 | Use JD vocabulary naturally (≥ 3 key JD terms) but never keyword-stuff; CV carries must-have keywords | Letters indexed but rarely scored [S15] | Low | Yes (term overlap + density cap) |
| CL-FM-20 | Speculative letters: state year of study + exact ask (type, dates); one firm-specific research point; set a 14-day follow-up reminder | [S20][S21][S6] | Medium | Partly (reminder = yes) |
| CL-FM-21 | Don't generate a speculative letter to an employer whose site says it doesn't accept them | [S21] | Medium | Partly (needs scrape) |
| CL-FM-22 | If the form has a dedicated right-to-work/sponsorship question, answer it there and omit visa from the letter | Saves words; avoids contradictions | High | Yes |
| CL-FM-23 | Visa sentence (opt-in only): ≤ 2 sentences, final paragraph, facts only ("Graduate visa, no sponsorship required"), no legal advice; pull duration from a dated config, not model memory | Rules change 1 Jan 2027 [S30]; careers services can't advise [S35] | Critical | Yes (position + config check) |
| CL-FM-24 | Never assert visa status, right to work, disability or grades the user hasn't stored in their profile | Hallucinated legal facts are harmful | Critical | Yes (claim ↔ profile check) |
| CL-FM-25 | Disability/health: never mention unless user explicitly opts in; if so, ≤ 2 sentences, strengths-linked, no diagnosis required | Optional disclosure [S5][S36][S37] | Critical | Yes (opt-in flag) |
| CL-FM-26 | Disability Confident opt-in → letter must explicitly evidence each listed essential criterion | Guaranteed interview depends on it [S39] | High | Partly (criteria coverage) |
| CL-FM-27 | Gaps: at most one sentence, positioned after the main evidence, framed as what was done/learned | [S40][S41] | Medium | Partly |
| CL-FM-28 | Salary only if the advert asks | [S6] | Low | Yes |
| CL-FM-29 | If employer accepts no letter (F7), route motivation content to the form's questions; don't upload into "Other documents" | e.g. PwC UK [S17] | Medium | Yes (field detection) |
| CL-FM-30 | Store both a rendered PDF and a plain-text twin of every letter so the extension can choose upload vs paste (Greenhouse supports both) | [S1][S2] | High | Yes |
| CL-FM-31 | Before submit, show the user the final text and the exact limit/usage; never auto-submit | Irreversible action; user owns content | Critical | Yes |

---

## 6. Open questions

1. **Real text-box limits per UK employer.** No vendor publishes defaults (Workday, Taleo, Avature are configured per tenant). Can Autopilot capture `maxlength` / on-page counters into the job record so limits become data, not guesses?
2. **Word vs character counting.** Do Workday/SuccessFactors counters include newlines? Needs E2E check on a live form.
3. **Taleo merge behaviour** (letter merged into resume PDF) is single-source; verify on a real Taleo tenant before relying on it.
4. **"Kind regards" in uploaded letters.** Increasingly common in UK emails; no careers-service source endorses it for formal letters. Keep formal pairing for F1 until evidence says otherwise.
5. **Student-visa internship eligibility.** Term-time hours caps vs full-time vacation work: should the generator block "available full-time" claims for summer internships that overlap term? Needs a rules source (UKCISA) and the user's term dates.
6. **Predicted grades / mitigating circumstances.** No careers-service guidance found; propose asking UCL Careers directly.
7. **Address block for students.** Is home address still expected on uploaded letters in 2026, or is name + email + phone + LinkedIn enough? Templates still show it; recruiter practice suggests not needed. Privacy argues for omitting by default.
8. **Which target employers still want letters?** eFinancialCareers says some banks (e.g. Goldman) expect them while others use questions [S16]; PwC UK uses no letter [S17]. Worth a per-employer flag in the ingest table.
9. **UCL, Oxford pages blocked (403)** to automated fetch; content behind Career Discovery login. Rules attributed to those services above are from search snippets only.

---

## 7. Sources

Official / careers services / government / vendor docs:
- [S1] Greenhouse live application forms (PandaDoc, JCDecaux postings): https://job-boards.greenhouse.io/pandadoc/jobs/7807538 , https://job-boards.greenhouse.io/jcdecaux/jobs/7984393002
- [S2] Greenhouse Job Board API docs, applications: https://github.com/grnhse/greenhouse-api-docs/blob/4dab9c1b6465d0c4db795f275a21b2e428dd3643/source/includes/job-board/_applications.md
- [S3] Staffordshire, Aberystwyth, Brunel careers templates: https://www.staffs.ac.uk/students/docs/pdf/careers/how-to-write-a-cover-letter.pdf , https://aber.ac.uk/en/media/departmental/careers/pdf/covlettertemplate_en.pdf , https://www.brunel.ac.uk/pdc/documents/pdf/Sample-Cover-Letter.pdf
- [S4] University of Manchester Careers, cover letter template: https://www.careers.manchester.ac.uk/applicationsinterviews/cl/cltemplate/
- [S5] University of Nottingham Careers, covering letters: https://www.nottingham.ac.uk/careers/students/applications/covering-letters.aspx
- [S6] Prospects (Jisc), cover letters: https://www.prospects.ac.uk/careers-advice/cvs-and-cover-letters/cover-letters
- [S7] University of St Andrews Careers, cover letters: https://st-andrews.ac.uk/careers/how-to-apply/cover-letters
- [S8] University of Salford, Writing a Covering Letter (2025): https://www.salford.ac.uk/sites/default/files/2026-03/writing-a-covering-letter-2025_0.pdf
- [S9] Workday applicant guide (CSU Pueblo) and NVIDIA forum upload cap: https://www.csupueblo.edu/human-resources/_doc/applying-for-a-position-in-workday.pdf , https://forums.developer.nvidia.com/t/unable-to-upload-resume-in-nvidia-workday-application/381762
- [S10] Ashby docs, application forms + file categories: https://docs.ashbyhq.com/application-forms , https://ashbyhq.notion.site/2afdc989d7bd805b89c0d3230b897784
- [S11] SAP SuccessFactors KBAs: https://userapps.support.sap.com/sap/support/knowledge/en/2611085 , https://userapps.support.sap.com/sap/support/knowledge/en/2271789
- [S13] Indeed Help Centre, cover letters: https://support.indeed.com/hc/en-gb/articles/32096856897933
- [S14] Generic portal job aid (optional Add Cover Letter step): https://asds.nbed.ca/wp-content/uploads/2026/07/Apply-for-a-job-external-applicants.pdf
- [S18] University College Cork Careers, application forms: https://www.ucc.ie/en/careers/areyouacurrentstudent/applicationstoolkit/applicationformsonlineapplications/
- [S19] University of Sheffield Careers, answering application questions: https://sheffield.ac.uk/careers/support/apply/applications/answering-application-questions
- [S20] University of St Andrews, speculative applications: https://www.st-andrews.ac.uk/careers/how-to-apply/speculative-applications/
- [S21] LSE Careers, speculative applications: https://info.lse.ac.uk/current-students/careers/information-and-resources/application-process/speculative-applications , https://blogs.lse.ac.uk/careers/2020/03/19/making-speculative-applications
- [S22] LSE PhD speculative application guide: https://info.lse.ac.uk/current-students/careers/Assets/Documents/PhD/SpecApp.pdf
- [S23] Sheffield Hallam, speculative applications: https://www.shu.ac.uk/careers/application-tips/speculative-applications
- [S24] Essex / Teesside careers: https://www.essex.ac.uk/student/get-application-support/cover-letters , https://www.tees.ac.uk/docs/docrepo/student%20futures/covering_letter_tips.pdf
- [S25] UCL Careers, writing applications: https://www.ucl.ac.uk/careers/applying/applications
- [S26] King's College London Careers, applications: https://kcl.ac.uk/careers/supporting-you/applications.aspx
- [S27] Imperial Careers Service publications: https://www.imperial.ac.uk/careers/about/careers-library/careers-service-publications/
- [S28] Oxford Careers Service, cover letters + Oxford Guide to Careers 2026: https://www.ox.ac.uk/careers/job-search-and-applications/writing-applications/cover-letters , https://www.careers.ox.ac.uk/sitefiles/oxford-guide-to-careers-2026.pdf
- [S29] Cambridge Careers Service, CVs and cover letters: https://www.careers.cam.ac.uk/applying-for-jobs/cvs-and-cover-letters
- [S30] GOV.UK, Graduate visa: https://www.gov.uk/graduate-visa
- [S34] Cardiff University, cover letter template for international students: https://sites.cardiff.ac.uk/studentfuturesplus/files/2025/12/Cover-Letter-Template-for-Placement-International-Masters-Students.docx
- [S35] University of Strathclyde Careers, work in the UK after graduation: https://www.strath.ac.uk/professionalservices/careers/students/internationalstudents/workintheukaftergraduation
- [S36] Bath Spa Guide to Disability and Work; Warwick Careers: https://WWW.BATHSPA.AC.UK/media/bathspaacuk/students/careers/careers-documents/Guide-to-Disability-and-Work.pdf , https://warwick.ac.uk/services/careers/help/diversity/disabilityandmentalhealth/marketing
- [S37] EHRC, pre-employment health questions (Equality Act s.60): https://archive.equalityhumanrights.com/sites/default/files/pre-employment_health_questions_for_employers_0.pdf
- [S39] Citizens Advice, Disability Confident guidance for applicants: https://www.citizensadvice.org.uk/about-us/information/disability-confident-guidance-for-applicants/
- [S40] National Careers Service, explain gaps in work history: https://nationalcareers.service.gov.uk/careers-advice/explain-gaps-in-work-history/
- [S41] Prospects, how to explain a gap in your CV: https://prospects.ac.uk/careers-advice/cvs-and-cover-letters/cover-letters/how-to-explain-a-gap-in-your-cv
- [S43] Nottingham Careers, post-study career guide for international students: https://www.nottingham.ac.uk/careers/students/career-insights/navigating-your-post-study-career-in-the-uk-a-guide-for-international-students.aspx

Secondary (treat as unverified):
- [S12] Loopcv, Lever application tips: https://blog.loopcv.pro/lever-application-tips/amp/ ; [S12a] 100hires Lever API guide: https://100hires.com/lever-api.html
- [S15] ATS Verification, "Do ATS read cover letters" (2026 test of Workday/Greenhouse/Lever/Taleo): https://atsverification.com/blog/do-ats-read-cover-letters-workday-greenhouse-lever-tested/
- [S16] eFinancialCareers, banking cover letter template: https://www.efinancialcareers.co.uk/news/cover-letter-template-will-get-job-banking
- [S17] TargetJobs, PwC graduate application process: https://targetjobs.co.uk/careers-advice/cvs-applications-and-tests/pwc-graduate-application-process-explained
- [S31] DavidsonMorris, Graduate visa guide for employers: https://www.davidsonmorris.com/graduate-visa-guide-for-employers/
- [S32] Paragon Law, Graduate visa: https://www.paragonlaw.co.uk/personal-immigration/working-in-uk/graduate-visa
- [S33] UKCISA, Experiencing the UK Graduate route (case study): https://ukcisa.org.uk/Research--Policy/Resource-bank/resources/242/Experiencing-the-UK-Graduate-route-China-higher-degree
- [S38] CV Maker UK, illness or disability on CV: https://www.cvmaker.uk/blog/cv/illness-or-disability-on-cv
- [S42] Youth Employment UK, explaining CV gaps: https://youthemployment.org.uk/how-to-explain-cv-gaps-in-a-positive-way-to-employers

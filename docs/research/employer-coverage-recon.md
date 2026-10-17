# Employer coverage recon: top-tier UK employers

Snapshot: **2026-10-17**. Counts are what each endpoint returned that day. Early-careers boards are seasonal, so treat the numbers as rough.

This doc records, for each top-tier employer, the JSON endpoint its own careers site calls, whether a plain `fetch` can call it, and a verdict. Tasks 3, 7, 8 and 9 read it.

## Method

- `scripts/recon/capture_xhr.py` (Scrapling `DynamicFetcher`, headless Chromium) loaded one early-careers search page per employer and listed the JSON XHR/fetch calls. No `StealthyFetcher`, no `solve_cloudflare`, no proxies, no logins, no CAPTCHA or cookie-banner clicks. Runs were sequential, about 4 s apart.
- A second page load happened only when the first URL was wrong (Deloitte, KPMG, HSBC, Goldman Sachs campus) or the tool itself crashed or hung on the first load and was fixed (PwC, KPMG, Goldman Sachs, Meta, McKinsey, BCG). The fixes are in the script: request bodies matched by order, gzipped beacon bodies, a hard watchdog for pages that never reach network idle, one attempt per run instead of Scrapling's default three.
- Each endpoint found was then called with plain Node `fetch` (`accept: application/json`, no cookies, no browser headers). A few endpoints needed one or two extra plain calls to find the UK filter (country code lookups and facet values).
- No response bodies are committed. Several payloads carry recruiter names or emails: Oracle `ExternalContactName` / `ExternalContactEmail`, Bank of America `primaryRecruiter`, Phenom `hiringManager`. Providers must not read or store those fields.

## Verdicts

| Employer | Verdict | Endpoint | Plain fetch | UK early-careers today |
|---|---|---|---|---|
| PwC UK | `existing:workday/pwc/CRM_Campus_Careers_Site` (apiHost `pwc.wd3.myworkdayjobs.com`, not yet seeded) | Workday cxs; the Phenom site's apply links point here | 200 | 94 on the Phenom UK site; Workday site has 192 across PwC firms |
| Deloitte UK | `curated` | Avature, server-rendered HTML; RSS feed exists | 200 (RSS) | 20 items in RSS, titles only |
| EY UK | `curated` | SAP SuccessFactors career site, server-rendered results | n/a | not counted |
| KPMG UK | `curated` | Server-rendered vacancy pages, no JSON | n/a | not counted |
| JPMorgan | `provider:oracle` | Oracle Recruiting Cloud `recruitingCEJobRequisitions`, site `CX_1001` | 200 | 13 programme titles in the newest 200 of 673 UK rows |
| Goldman Sachs | `provider:goldmansachs` | GraphQL `api-higher.gs.com/gateway/api/v1/graphql`, `experiences: ["CAMPUS"]` | 200 | 40 |
| Morgan Stanley | `provider:morganstanley` (existing Workday `ms/External` has no campus roles) | `resultset.json?opportunity=sg` | 200 | 33 |
| Citi | `existing:workday/citi/2` (apiHost `citi.wd5.myworkdayjobs.com`) | jobs.citi.com is a Radancy HTML site | n/a | see benchmark |
| Barclays | `existing:workday/barclays/External_Career_Site_Barclays` (apiHost `barclays.wd3.myworkdayjobs.com`) | search.jobs.barclays is a Radancy HTML site | n/a | see benchmark |
| HSBC | `curated` | hsbc.com programme list and `apply.careers.hsbc.com/emergingtalent` (SuccessFactors), both server-rendered | n/a | not counted |
| Bank of America | `provider:bankofamerica` | `careers.bankofamerica.com/services/campusjobssearchservlet` | 200 | 11 |
| UBS | `curated` | BrassRing (Kenexa) jobs embedded in HTML; paging needs an encrypted session value | 200 (page 1 only) | 1 on page 1 of 94 global |
| Deutsche Bank | `provider:deutschebank` (existing Workday `db/DBWebSite` has no early-careers roles) | `api-deutschebank.beesite.de/graduatesearch/` | 200 | 8 |
| Google | `curated` | Server-rendered, positional protobuf-style arrays | 200 (HTML) | 0 for UK + EARLY + INTERN |
| Microsoft | `provider:eightfold` | Eightfold PCSX `apply.careers.microsoft.com/api/pcsx/search` | 200 | 73 UK rows, all levels; title filter needed |
| Meta | `curated` | GraphQL with page-issued tokens, `text/html` responses | not tried | not counted |
| Apple | `provider:apple` | JSON embedded in the search page (`__staticRouterHydrationData`) | 200 (HTML) | 13 |
| Amazon | `provider:amazon` | `amazon.jobs/en-gb/search.json` | 200 | 40 |
| McKinsey | `provider:mckinsey` | `gateway.mckinsey.com/apigw-x0cceuow60/v1/api/jobs/search` | 200 | 48 UK rows; 5 are student or graduate entry roles |
| BCG | `provider:phenom` | Phenom `careers.bcg.com/widgets` `refineSearch` | 200 | 112 UK rows; 3 student or entry roles |
| Bain | `curated` (blocked) | Cloudflare "Just a moment" page, 403 | n/a | not counted |

Totals: 10 `provider`, 3 `existing`, 0 `stealth`, 8 `curated` (one of them blocked).

No endpoint answered a plain `fetch` with 403, so nothing needs the stealth transport. The two that look closest are Microsoft (its API answered "Please try again later" to one unrecognised filter parameter) and UBS (session-bound paging).

`provider:phenom` covers BCG. PwC UK's Phenom site uses the same API (`jobs.pwc.co.uk/earlycareers/widgets`), but its jobs also sit on Workday, which needs no new code.

## Per employer

### PwC UK: `existing:workday/pwc/CRM_Campus_Careers_Site`

- Search page: `https://jobs.pwc.co.uk/earlycareers/uk/en/search-results` (Phenom, refNum `PUDPUNUK`, siteType `earlycareers`).
- Captured: `POST https://jobs.pwc.co.uk/earlycareers/widgets` with `ddoKey: "refineSearch"`. Plain fetch with this body returned 200 and all 94 jobs in one response:
  `{"lang":"en_uk","deviceType":"desktop","country":"uk","pageName":"search-results","ddoKey":"refineSearch","sortBy":"","subsearch":"","from":0,"jobs":true,"counts":true,"all_fields":["audience","categoryCluster","recruitingProgrammeearlycareers","location"],"size":100,"clearAll":false,"jdsource":"facets","isSliderEnable":false,"pageId":"page1177-ds","siteType":"earlycareers","keywords":"","global":true,"selected_fields":{},"locationData":{}}`
- Programme facet: Summer Internship 28, Graduate 23, Entry Level 15, Black Talent in Business 10, Women in Business 9, Advancing Social Mobility 7, Flying Start 1, Undergraduate placement 1.
- Every `applyUrl` points at `https://pwc.wd3.myworkdayjobs.com/CRM_Campus_Careers_Site/job/...`. The Workday cxs endpoint `POST https://pwc.wd3.myworkdayjobs.com/wday/cxs/pwc/CRM_Campus_Careers_Site/jobs` with `{"limit":20,"offset":0,"appliedFacets":{},"searchText":""}` returned 200, `total: 192`. It mixes PwC firms (Amsterdam, Guadalajara, Belfast…), so the existing UK location filter applies.
- Recommendation: add a seed row `{ slug: pwc/CRM_Campus_Careers_Site, name: PwC, ats: workday, apiHost: pwc.wd3.myworkdayjobs.com }`. This closes the "UK student site not found yet" note in `seed/companies.yml`. Phenom stays a fallback.

### Deloitte UK: `curated`

- `https://www.deloitte.com/uk/en/careers/search-jobs.html` (first load) only links out. The early-careers board is Avature: `https://apply.deloitte.co.uk/UKEarlyCareers/SearchJobs` (second load). Results are server-rendered, and the page makes no JSON job calls.
- Avature RSS `https://apply.deloitte.co.uk/UKEarlyCareers/SearchJobs/feed/` answers a plain fetch with 200 XML: 20 `<item>`s with title, link (`/UKEarlyCareers/JobDetail/<slug>/<id>`) and pubDate. There is no location, description or paging info. It isn't JSON and would need HTML detail pages, so the verdict stays `curated`. An Avature RSS provider is a possible later step.

### EY UK: `curated`

- `https://careers.ey.com/search/?createNewAlert=false&q=&optionsFacetsDD_customfield1=&optionsFacetsDD_country=GB&optionsFacetsDD_city=` (SAP SuccessFactors Recruiting Marketing).
- Only JSON call: `POST https://careers.ey.com/services/jobs/options/facetValues/` (facets, no jobs). Results are server-rendered HTML.

### KPMG UK: `curated`

- `https://www.kpmgcareers.co.uk/search/` is the landing page. The vacancy list is at `https://www.kpmgcareers.co.uk/search/vacancies/?experienceLevels[0]=Graduate&intakeType=null&searchText=&page=1`. Both are server-rendered, and the only JSON is analytics.
- The first run crashed on a gzipped analytics beacon. That was a script bug, now fixed.

### JPMorgan: `provider:oracle`

- Tenant host `jpmc.fa.oraclecloud.com`, siteNumber **`CX_1001`**. Campus programmes (Spring Insights, internships) are on the same site as experienced roles; there is no separate campus site.
- UK `locationId` **`300000000289276`** ("United Kingdom", 673 rows). The id in my first URL, `300000000289360`, is India.
- List (plain fetch 200, `items[0].TotalJobsCount` = 673, `requisitionList` = 200):
  `https://jpmc.fa.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1001,facetsList=TITLES%3BCATEGORIES,limit=200,offset=0,locationId=300000000289276,sortBy=POSTING_DATES_DESC`
- Detail (plain fetch 200):
  `https://jpmc.fa.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%22210795361%22,siteNumber=CX_1001`
- Paging: `limit` and `offset` sit inside the `finder=` clause. Read `items[0].TotalJobsCount` and step `offset` until it is covered. If the total changes between pages, fail the board.
- List row keys: `Id, Title, PostedDate, PostingEndDate, PrimaryLocation, PrimaryLocationCountry, ShortDescriptionStr, WorkplaceType, JobFamily, JobFunction, StudyLevel, secondaryLocations, …`.
- Detail keys: `Id, Title, ExternalPostedStartDate, ExternalPostedEndDate, ExternalDescriptionStr, ExternalQualificationsStr, ExternalResponsibilitiesStr, CorporateDescriptionStr, PrimaryLocation, PrimaryLocationCountry, secondaryLocations, …`. Ignore `ExternalContactName` and `ExternalContactEmail`.
- RawJob: `extId` = `Id`; `title` = `Title`; `url` = `https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/<Id>`; `location` = `PrimaryLocation` (e.g. "LONDON, LONDON, United Kingdom"); `remote` = `WorkplaceType`/`WorkplaceTypeCode` says remote; `html` = detail `ExternalDescriptionStr` + `ExternalResponsibilitiesStr` + `ExternalQualificationsStr`; `postedAt` = `PostedDate`; `deadline` = date part of detail `ExternalPostedEndDate` (e.g. `2026-11-01T23:55:00+00:00` gives `2026-11-01`). List `PostingEndDate` was null.
- Title filter before detail calls. The 2026-10-17 programme titles were "2027 Spring Insights: … – London/Glasgow/Bournemouth" and "2027 AI Research Associate Program - Internship".

### Goldman Sachs: `provider:goldmansachs`

- Search page: `https://higher.gs.com/campus` (the first URL, `/results?EXPERIENCE_LEVEL=Campus…`, dropped the campus filter).
- Endpoint: `POST https://api-higher.gs.com/gateway/api/v1/graphql`. Plain fetch 200 with no cookies and no token:
  ```json
  {"operationName":"GetCampusRoles","variables":{"searchQueryInput":{"page":{"pageSize":100,"pageNumber":0},"sort":{"sortStrategy":"RELEVANCE","sortOrder":"DESC"},"filters":[{"filterCategoryType":"LOCATION","filters":[{"filter":"United Kingdom","subFilters":[]}]}],"experiences":["CAMPUS"],"searchTerm":""}},"query":"query GetCampusRoles($searchQueryInput: RoleSearchQueryInput!) { roleSearch(searchQueryInput: $searchQueryInput) { totalCount items { roleId corporateTitle jobTitle jobFunction locations { primary state country city } status division skills jobType { code description } externalSource { sourceId } educationLevel startDate } } }"}
  ```
  It returned `totalCount: 40`, all UK campus roles: Summer Analyst, Seasonal/Off-Cycle, New Analyst, Apprentice Programme and quant internships in London and Birmingham.
- `experiences: ["EARLY_CAREER"]` is a different pool (junior experienced hires) and returned 0 with the UK filter. Use `CAMPUS`.
- Paging: `page.pageNumber` and `pageSize`, with `totalCount`.
- Detail: the site loads `https://higher.gs.com/_next/data/<buildId>/roles/<id>.json?roleId=<id>` (plain fetch 200). The build id changes on every deploy, so don't use it. Task 8 should find a GraphQL role-detail query, or build the posting text from list fields.
- RawJob: `extId` = `roleId` (e.g. `175424_GS_CAMPUS`); `title` = `jobTitle`; `url` = `https://higher.gs.com/roles/<externalSource.sourceId>`; `location` = `locations[].city` joined with country; `remote` = false; `postedAt` = `startDate` (looks like a posting timestamp, not the programme start; confirm in Task 8); `deadline` = none seen.

### Morgan Stanley: `provider:morganstanley`

- Search page: `https://www.morganstanley.com/careers/career-opportunities-search?opportunity=sg`.
- Endpoint: `GET https://www.morganstanley.com/web/career_services/webapp/service/careerservice/resultset.json?&opportunity=sg&lang=EN&location=`. Plain fetch 200, about 1.2 MB, everything in one response: `totalResults: 108`, `resultSet` 108, 33 in the UK.
- No paging; one call returns every students and graduates opportunity worldwide. Filter `country == "United Kingdom"`.
- Row keys: `jobNumber, jobTitle, city, country, region, location, applicationDate, sortingDate, employmentType, educationLevel, jobDescription, jobHtmlDescription, url, division, businessArea, …`.
- RawJob: `extId` = `jobNumber`; `title` = `jobTitle`; `url` = `url` (`https://morganstanley.tal.net/vx/candidate/so/pm/1/pl/1/opp/<jobNumber>`); `location` = `city, country`; `remote` = false; `html` = `jobHtmlDescription`; `postedAt` = null (`sortingDate` is epoch ms and tracks the deadline, not posting); `deadline` = `applicationDate` parsed from "Nov 27, 2026" to `2026-11-27`.
- The existing Workday board `ms/External` stays for experienced roles. It carries no campus roles.

### Citi: `existing:workday/citi/2`

- `https://jobs.citi.com/search-jobs/United%20Kingdom/...` is a Radancy (TMP) HTML site. Its only JSON is geolocation (`SetSearchRequestGeoLocation`). It is already covered by `citi/2` on `citi.wd5.myworkdayjobs.com`.

### Barclays: `existing:workday/barclays/External_Career_Site_Barclays`

- `https://search.jobs.barclays/early-careers` is a Radancy HTML site, same pattern as Citi. It is already covered by the Workday board on `barclays.wd3.myworkdayjobs.com`.

### HSBC: `curated`

- `https://www.hsbc.com/careers/students-and-graduates/find-a-programme` is a server-rendered programme list. Its links go to `https://apply.careers.hsbc.com/emergingtalent/job/<slug>/<id>/?feedId=434057` (SAP SuccessFactors).
- `https://apply.careers.hsbc.com/emergingtalent/search/?q=&locationsearch=United+Kingdom` (second load) is server-rendered with no JSON job calls.

### Bank of America: `provider:bankofamerica`

- Search page: `https://careers.bankofamerica.com/en-us/students/job-search.html?ref=search&start=0&rows=10&search=getAllJobs`.
- Endpoint: `GET https://careers.bankofamerica.com/services/campusjobssearchservlet?start=0&rows=500&search=getAllJobs`. Plain fetch 200, `totalMatches: 52`, all 52 in one response, 11 in the UK (London, Chester).
- Paging: `start` and `rows`. A `rows` value at or above `totalMatches` returns everything; check `jobsList.length == totalMatches`.
- Row keys: `jobRequisitionId, postingTitle, city, country, locationString, applyByDate, postedDate, externalPostedDate, jobDescriptionExternal, externalUrl, jcrURL, division, …`. Ignore `primaryRecruiter`.
- RawJob: `extId` = `jobRequisitionId`; `title` = `postingTitle`; `url` = `https://careers.bankofamerica.com` + `jcrURL` (the apply link `externalUrl` goes to `bankcampuscareers.tal.net`); `location` = `city, country`; `remote` = false; `html` = `jobDescriptionExternal`; `postedAt` = `postedDate`; `deadline` = `applyByDate` parsed from "Oct 22, 2026" to `2026-10-22`.

### UBS: `curated`

- `https://jobs.ubs.com/TGnewUI/Search/home/HomeWithPreLoad?partnerid=25008&siteid=5131&PageType=searchResults&SearchType=linkquery&LinkID=15232` (BrassRing / Kenexa).
- The only JSON XHR is `POST /TgNewUI/Search/Ajax/HomeSearch` (form body `partnerId=25008&siteId=5131`), which returns screening questions, not jobs.
- Jobs are embedded in the HTML as a hidden `preLoadJSON` input: page 1 holds 50 of `TotalCount: 94` (global early careers), and only 1 of those 50 is in the UK. Further pages need the per-session `EncryptedSessionValue`. Reading page 1 alone would be a partial list, which the global constraints forbid.

### Deutsche Bank: `provider:deutschebank`

- Search page: `https://careers.db.com/students-graduates/` (beesite).
- Endpoint: `GET https://api-deutschebank.beesite.de/graduatesearch/?data=<url-encoded JSON>`. Plain fetch 200. With a UK filter:
  ```json
  {"LanguageCode":"en","SearchParameters":{"FirstItem":1,"CountItem":100,"MatchedObjectDescriptor":["PositionID","PositionTitle","PositionURI","PositionLocation.CountryName","PositionLocation.CityName","PublicationStartDate","PublicationEndDate","CareerLevel.Name","PositionHiringYear","PositionFormattedDescription.Content"],"Sort":[{"Criterion":"PublicationStartDate","Direction":"DESC"}]},"SearchCriteria":[{"CriterionName":"PositionLocation.Country","CriterionValue":["71"]}]}
  ```
  Country id `71` = United Kingdom, from `GET https://api-deutschebank.beesite.de/lookup/country/lang/2`. It returned `SearchResultCount: 8`, `SearchResultCountAll: 8` (75 worldwide).
- Paging: `FirstItem` (1-based) and `CountItem`, with `SearchResultCountAll`.
- Row path: `SearchResult.SearchResultItems[].MatchedObjectDescriptor` with `PositionID, PositionTitle, PositionURI, PositionLocation[], PublicationStartDate, PublicationEndDate, CareerLevel[], PositionHiringYear`.
- RawJob: `extId` = `PositionID`; `title` = `PositionTitle`; `url` = `PositionURI` (`https://db.recsolu.com/external/requisitions/<token>`); `location` = `PositionLocation[0].CityName, CountryName`; `remote` = false; `postedAt` = `PublicationStartDate`; `deadline` = `PublicationEndDate` (e.g. `2026-10-18`).
- Open: `PositionFormattedDescription.Content` came back empty in the list. Task 8 needs a description source, either a beesite detail call or the recsolu page.
- The existing Workday board `db/DBWebSite` has 0 early-careers rows, per the benchmark.

### Google: `curated`

- `https://www.google.com/about/careers/applications/jobs/results/?location=United%20Kingdom&target_level=EARLY&employment_type=INTERN`. Results are server-rendered into `AF_initDataCallback` positional arrays; the only XHRs are telemetry and `browserinfo`. A plain fetch of the page gives 200, and `ds:1` was `[null,null,0,20]`, meaning 0 results for this query today.
- The wire format is undocumented positional arrays, so it isn't a stable provider target. Use a curated programme card (Google STEP / SWE internships).

### Microsoft: `provider:eightfold`

- `https://jobs.careers.microsoft.com/global/en/search?...` now redirects to Eightfold at `https://apply.careers.microsoft.com/careers`. The script flagged a "captcha" string in the page, but that was a script tag; the page and its API loaded normally, so it isn't a challenge.
- List: `GET https://apply.careers.microsoft.com/api/pcsx/search?domain=microsoft.com&query=&location=United%20Kingdom&start=0`. Plain fetch 200, `data.count: 73`, 10 positions per page.
- Detail: `GET https://apply.careers.microsoft.com/api/pcsx/position_details?position_id=<id>&domain=microsoft.com&hl=en`. Plain fetch 200; `data.jobDescription` was about 8.6 KB.
- Paging: `start` steps by 10 up to `data.count`.
- Early-career filter: the UI offers "Experience level" (`seniority`: Entry, Intern). `seniority=Entry&seniority=Intern` was ignored (still 73), and `filter_seniority=…` answered `Please try again later` (text/plain). No working server-side filter was found, so title-filter the 73 UK rows before detail calls. Keep request volume low: the API is touchy.
- Row keys: `id, displayJobId, name, locations[], standardizedLocations, postedTs (epoch s), department, workLocationOption, positionUrl`.
- RawJob: `extId` = `id`; `title` = `name`; `url` = `https://apply.careers.microsoft.com` + `positionUrl`; `location` = `locations[0]`; `remote` = `workLocationOption` says remote; `html` = detail `jobDescription`; `postedAt` = `postedTs` × 1000 as ISO; `deadline` = none.

### Meta: `curated`

- `https://www.metacareers.com/jobsearch/?offices[0]=London%2C%20UK&roles[0]=Internship`. The data calls are `POST https://www.metacareers.com/graphql` returning `text/html` (Relay), driven by page-issued `lsd`/`fb_dtsg` tokens and `doc_id`s. Calling it means replaying session tokens, so I didn't try a plain fetch.

### Apple: `provider:apple`

- `https://jobs.apple.com/en-gb/search?location=united-kingdom-GBR&team=internships-STDNT-INTRN`. No job XHR on first load: the results are server-rendered.
- A plain `GET` of that URL (`accept: text/html`) returns 200. The page embeds `window.__staticRouterHydrationData = JSON.parse("…")`, and `loaderData.search` holds `searchResults` (13) and `totalRecords: 13`.
- Row keys: `id, positionId, postingTitle, transformedPostingTitle, jobSummary, locations[], postDateInGMT, postingDate, team, type, homeOffice, reqId`. A position with several UK locations appears once per location (same `positionId`), so dedupe by `positionId`.
- RawJob: `extId` = `positionId`; `title` = `postingTitle`; `url` = `https://jobs.apple.com/en-gb/details/<positionId>/<transformedPostingTitle>`; `location` = `locations[].name` joined; `remote` = `homeOffice`; `html` = `jobSummary` (short; the detail page likely embeds the full text the same way); `postedAt` = `postDateInGMT`.
- Paging: the URL `page=` parameter; 13 fit on one page today.
- Caveat: this parses embedded JSON out of HTML, which is more brittle than an API. The provider should fail the board if the marker is missing.

### Amazon: `provider:amazon`

- The page's own call used a mangled parameter (`undefinedbusiness_category[]=student-programs`). The working query:
  `GET https://www.amazon.jobs/en-gb/search.json?country=GBR&business_category%5B%5D=studentprograms&offset=0&result_limit=100&sort=recent`
  Plain fetch 200, `hits: 40`, `jobs` 40.
- `business_category[]=student-programs` and `normalized_country_code[]=GBR` both return 0. The facet value is `studentprograms`. The UK `is_intern` facet is 46 and `studentprograms` is 40.
- Paging: `offset` and `result_limit` with `hits`.
- The list rows already include full text, so no detail call is needed. Keys: `id_icims, title, job_path, normalized_location, city, country_code, posted_date, description, basic_qualifications, preferred_qualifications, is_intern, university_job, business_category, team`.
- RawJob: `extId` = `id_icims`; `title` = `title`; `url` = `https://www.amazon.jobs` + `job_path`; `location` = `normalized_location` ("London, England, GBR"); `remote` = false; `html` = `description` + `basic_qualifications` + `preferred_qualifications`; `postedAt` = `posted_date` parsed from "October  7, 2026" (note the double space); `deadline` = none.

### McKinsey: `provider:mckinsey`

- `https://www.mckinsey.com/careers/search-jobs?countries=United%20Kingdom`. The page loads an Akamai sensor and never reaches network idle; the search call appeared after about 100 s.
- Endpoint: `GET https://gateway.mckinsey.com/apigw-x0cceuow60/v1/api/jobs/search?pageSize=100&start=1&countries=United+Kingdom&lang=en`. Plain fetch 200, `numFound: 48`, `docs` 48. `.../v1/api/jobs/masterdata` (regions, interests) also answers a plain fetch.
- Paging: `start` (1-based) and `pageSize`, with `numFound`.
- Row keys: `jobID, title, interest, interestCategory, cities[], countries[], functions, industries, whoYouWillWorkWith, whatYouWillDo, yourBackground, jobApplyURL, friendlyURL, recordTypeName`.
- Entry roles in the UK set: Business Analyst, Business Analyst Intern, Associate, Associate Intern, Junior Associate. These are global evergreen postings listing many cities, London among them.
- RawJob: `extId` = `jobID`; `title` = `title`; `url` = `https://www.mckinsey.com/careers/search-jobs/jobs/<friendlyURL>`; `location` = "London, United Kingdom" when `cities` includes London; `remote` = false; `html` = `whoYouWillWorkWith` + `whatYouWillDo` + `yourBackground`; `postedAt` = null (no date field seen); `deadline` = none.

### BCG: `provider:phenom`

- `https://careers.bcg.com/global/en/search-results?keywords=london` (Phenom, refNum `BCG1US`, siteType `external`). The page never settles; the watchdog listed the `POST https://careers.bcg.com/widgets` calls.
- Plain fetch 200 with:
  `{"lang":"en_global","deviceType":"desktop","country":"global","pageName":"search-results","ddoKey":"refineSearch","sortBy":"","subsearch":"","from":0,"jobs":true,"counts":true,"all_fields":["category","country","city","type"],"size":100,"clearAll":false,"jdsource":"facets","isSliderEnable":false,"pageId":"page11","siteType":"external","keywords":"","global":true,"selected_fields":{"country":["United Kingdom"]},"locationData":{}}`
  It returned `totalHits: 112` and 100 jobs. Some rows are multi-location and have a non-UK primary location, so filter on `multi_location`.
- Paging: `from` and `size`, with `totalHits`.
- Row keys: `jobId, jobSeqNo, reqId, title, location, city, country, multi_location, postedDate, dateCreated, type, category, descriptionTeaser, applyUrl`. Ignore `hiringManager` if present.
- Student or entry rows in the UK set: "Associate/Senior Associate, Full-Time, London" and two BCG X internships. Most of the 112 are experienced roles, so the title filter matters.
- RawJob: `extId` = `jobId`; `title` = `title`; `url` = `https://careers.bcg.com/global/en/job/<jobId>` (`applyUrl` goes to `experiencedtalent.bcg.com`); `location` = `location`; `remote` = false; `html` = `descriptionTeaser` (a Phenom job-detail widget call would give full text); `postedAt` = `postedDate`.

### Bain: `curated` (blocked)

- `https://www.bain.com/careers/find-a-role/?filters=offices(275)` returned 403 with the Cloudflare "Just a moment..." interstitial (`challenges.cloudflare.com`). I recorded it as blocked and did not retry.

## Notes for later tasks

- Task 3 (Oracle, Amazon fixtures): the JPMorgan list and detail URLs and the Amazon query above are the exact ones that answered 200.
- Several providers return everything in one call (Morgan Stanley, Bank of America, Amazon at `result_limit=100`, Deutsche Bank at `CountItem=100`, McKinsey at `pageSize=100`). Still check the returned count against the reported total, so a short page fails the board.
- Deadlines come from structured fields for JPMorgan (detail `ExternalPostedEndDate`), Morgan Stanley (`applicationDate`), Bank of America (`applyByDate`) and Deutsche Bank (`PublicationEndDate`).
- Curated programme cards are needed for Deloitte, EY, KPMG, HSBC, UBS, Google, Meta and Bain.

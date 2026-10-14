-- Allow SmartRecruiters boards (slug = company identifier in jobs.smartrecruiters.com/{identifier}).
-- Must be applied before `npm run seed` upserts the smartrecruiters rows in seed/companies.yml.
alter table companies drop constraint if exists companies_ats_check;
alter table companies add constraint companies_ats_check check (ats in ('greenhouse','lever','ashby','workday','smartrecruiters'));

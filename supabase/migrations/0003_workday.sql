-- Allow Workday boards (slug = "{tenant}/{site}", api_host = "{tenant}.wdN.myworkdayjobs.com").
alter table companies drop constraint if exists companies_ats_check;
alter table companies add constraint companies_ats_check check (ats in ('greenhouse','lever','ashby','workday'));

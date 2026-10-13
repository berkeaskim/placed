-- Deterministic deadline provenance + observed closure.
-- deadline_source: 'ats' (structured field, e.g. Workday endDate) | 'text' (regex on the JD) | null (none found)
-- rolling: JD says rolling recruitment / may close early
-- closed_at: first ingest run where the posting was gone (true close date for ATSs that publish none)
-- Opening date needs no column: coalesce(posted_at, first_seen).
alter table public.jobs
  add column if not exists deadline_source text check (deadline_source in ('ats','text')),
  add column if not exists rolling boolean not null default false,
  add column if not exists closed_at timestamptz;

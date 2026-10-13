-- Gamify hardening. Idempotent: safe to run more than once.
create unique index if not exists xp_events_once_per_job
  on public.xp_events (user_id, type, job_id) where job_id is not null;
create unique index if not exists xp_events_once_per_user
  on public.xp_events (user_id, type) where type in ('onboarding_complete','cv_uploaded','quiz_done');

create or replace function public.increment_xp(p_delta int) returns int
language sql security invoker set search_path = '' as $$
  update public.profiles set xp = xp + p_delta where user_id = auth.uid() returning xp
$$;
grant execute on function public.increment_xp(int) to authenticated;

-- Indexes deferred from Task 2
create index if not exists cvs_user_idx on public.cvs (user_id);
create index if not exists cv_scores_user_idx on public.cv_scores (user_id);
create index if not exists cv_scores_cv_idx on public.cv_scores (cv_id);
create index if not exists confirmed_facts_user_idx on public.confirmed_facts (user_id);
create index if not exists xp_events_user_idx on public.xp_events (user_id);
create index if not exists applications_job_idx on public.applications (job_id);

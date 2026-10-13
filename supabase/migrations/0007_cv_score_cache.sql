-- Task 18 (CV Score): content-hash cache columns on cv_scores (06 R2) and the cv_feedback table
-- for the "I disagree" button (Task 18b). Idempotent: safe to run more than once.
-- Numbered 0007 because 0005 is reserved for Task 19b and 0006 is taken by 0006_gamify_server_only.sql.

-- Cache key = sha256(normalised redacted text) + sector + rules_version + model_id + prompt_version.
alter table public.cv_scores
  add column if not exists text_hash text,
  add column if not exists model_id text,
  add column if not exists prompt_version text,
  add column if not exists rules_version text;

create index if not exists cv_scores_cache_idx
  on public.cv_scores (user_id, sector, text_hash, model_id, prompt_version, rules_version);

-- "I disagree" feedback per fix: records the disagreement and changes nothing else.
create table if not exists public.cv_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  cv_id uuid references public.cvs on delete cascade,
  rule_id text not null,
  sector text not null,
  created_at timestamptz default now()
);

create index if not exists cv_feedback_user_idx on public.cv_feedback (user_id);
create index if not exists cv_feedback_cv_idx on public.cv_feedback (cv_id);

alter table public.cv_feedback enable row level security;

-- Guarded creates (not drop + create) so re-running never leaves a window without the policy.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cv_feedback' and policyname = 'own_select') then
    create policy "own_select" on public.cv_feedback for select to authenticated using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cv_feedback' and policyname = 'own_insert') then
    create policy "own_insert" on public.cv_feedback for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
end $$;

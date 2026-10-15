-- Combined: 0003, 0004, 0006, 0007, 0008, 0009. All idempotent; runs in one transaction (any error rolls back everything).
begin;

-- ==================== 0003_workday.sql ====================
-- Allow Workday boards (slug = "{tenant}/{site}", api_host = "{tenant}.wdN.myworkdayjobs.com").
alter table companies drop constraint if exists companies_ats_check;
alter table companies add constraint companies_ats_check check (ats in ('greenhouse','lever','ashby','workday'));

-- ==================== 0004_deadline_v2.sql ====================
-- Deterministic deadline provenance + observed closure.
-- deadline_source: 'ats' (structured field, e.g. Workday endDate) | 'text' (regex on the JD) | null (none found)
-- rolling: JD says rolling recruitment / may close early
-- closed_at: first ingest run where the posting was gone (true close date for ATSs that publish none)
-- Opening date needs no column: coalesce(posted_at, first_seen).
alter table public.jobs
  add column if not exists deadline_source text check (deadline_source in ('ats','text')),
  add column if not exists rolling boolean not null default false,
  add column if not exists closed_at timestamptz;

-- ==================== 0006_gamify_server_only.sql ====================
-- Gamify state is written by the server (service role) only. Idempotent: safe to run more than once.
-- Before this, any signed-in user could set their own xp/level/badges with the public key.

-- profiles: users may edit their own profile fields, never xp/level/streak. Rows are created by handle_new_user.
revoke insert, update on public.profiles from anon, authenticated;
grant update (display_name, year, field, location_pref, needs_visa, target_archetype, archetypes, skills, onboarded)
  on public.profiles to authenticated;
drop policy if exists "own_insert" on public.profiles;

-- xp_events / badges: read-only for users (deleting an event would let it be re-earned).
drop policy if exists "own_insert" on public.xp_events;
drop policy if exists "own_update" on public.xp_events;
drop policy if exists "own_delete" on public.xp_events;
drop policy if exists "own_insert" on public.badges;
drop policy if exists "own_update" on public.badges;
drop policy if exists "own_delete" on public.badges;
revoke insert, update, delete on public.xp_events, public.badges from anon, authenticated;

-- increment_xp let a user add any delta to their own xp; replaced by a service-role-only function.
drop function if exists public.increment_xp(int);
create or replace function public.award_xp(p_user uuid, p_delta int) returns int
language sql security invoker set search_path = '' as $$
  update public.profiles set xp = xp + p_delta where user_id = p_user returning xp
$$;
revoke execute on function public.award_xp(uuid, int) from public, anon, authenticated;
grant execute on function public.award_xp(uuid, int) to service_role;

-- ==================== 0007_cv_score_cache.sql ====================
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

-- ==================== 0008_rls_tightening.sql ====================
-- RLS / privilege tightening. Idempotent: safe to run more than once (drop-if-exists + create, revoke/grant).
--
-- 1. cv_scores: own_insert/own_update only checked user_id, so a user could attach score rows to another user's
--    CV id (the FK still passes). The write policies now also require the referenced CV to belong to the caller.
-- 2. cvs.storage_path and applications.tailored_cv_path are read by server code that signs/downloads them with the
--    service-role client. If a client could point them at another user's object, that would be an IDOR. So:
--      - table-level UPDATE is revoked from anon/authenticated and re-granted only on the columns the app
--        legitimately updates with the user's own client;
--      - INSERT policies additionally require any path to live under the caller's own `{auth.uid()}/` prefix
--        (the app already writes `${user.id}/...` for both buckets).
--
-- !! APP CONTRACT !! applications.tailored_cv_path is NOT client-updatable after this migration. Writes that set it
-- (tailorForJob, plan Task 23: the `applications` upsert that carries `tailored_cv_path`) MUST use the
-- service-role client (createAdminClient()) scoped to the authenticated user's id; the user client would get
-- "permission denied for table applications". cvs.storage_path is set only at insert time (profile/build actions).

-- 1. cv_scores: the referenced CV must be the caller's own -------------------------------------------------------
drop policy if exists "own_insert" on public.cv_scores;
drop policy if exists "own_update" on public.cv_scores;
drop policy if exists "own_insert_cv_owned" on public.cv_scores;
drop policy if exists "own_update_cv_owned" on public.cv_scores;
create policy "own_insert_cv_owned" on public.cv_scores for insert to authenticated
  with check (auth.uid() = user_id and exists (select 1 from public.cvs c where c.id = cv_scores.cv_id and c.user_id = auth.uid()));
create policy "own_update_cv_owned" on public.cv_scores for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and exists (select 1 from public.cvs c where c.id = cv_scores.cv_id and c.user_id = auth.uid()));

-- 2a. Storage paths are not client-updatable (column-level UPDATE) ------------------------------------------------
-- cvs: the only client-side UPDATE is activate_cv() (0009, SECURITY INVOKER), which flips is_active.
revoke update on public.cvs from anon, authenticated;
revoke update (storage_path) on public.cvs from anon, authenticated;
grant update (is_active) on public.cvs to authenticated;

-- applications: plan Tasks 20-24 update status/updated_at (tracker) and upsert on (user_id, job_id). PostgREST
-- upserts emit `on conflict do update set <every payload column>`, so user_id and job_id need UPDATE too; the
-- own_update policy's `with check (auth.uid() = user_id)` still pins ownership. tailored_json and verify_report
-- stay updatable so the tailoring result itself can be written by the user client if desired; tailored_cv_path
-- (and id) are excluded — see APP CONTRACT above.
revoke update on public.applications from anon, authenticated;
revoke update (tailored_cv_path) on public.applications from anon, authenticated;
grant update (user_id, job_id, status, tailored_json, verify_report, updated_at) on public.applications to authenticated;

-- 2b. Inserted paths must live under the caller's own prefix ------------------------------------------------------
drop policy if exists "own_insert" on public.cvs;
drop policy if exists "own_insert_path_scoped" on public.cvs;
create policy "own_insert_path_scoped" on public.cvs for insert to authenticated
  with check (auth.uid() = user_id and storage_path like (auth.uid()::text || '/%'));

drop policy if exists "own_insert" on public.applications;
drop policy if exists "own_insert_path_scoped" on public.applications;
create policy "own_insert_path_scoped" on public.applications for insert to authenticated
  with check (auth.uid() = user_id and (tailored_cv_path is null or tailored_cv_path like (auth.uid()::text || '/%')));

-- 3. cv_feedback (0007): same gap as cv_scores — the referenced CV (when given) must be the caller's own ----------
drop policy if exists "own_insert" on public.cv_feedback;
drop policy if exists "own_insert_cv_owned" on public.cv_feedback;
create policy "own_insert_cv_owned" on public.cv_feedback for insert to authenticated
  with check (auth.uid() = user_id and (cv_id is null or exists (select 1 from public.cvs c where c.id = cv_feedback.cv_id and c.user_id = auth.uid())));

-- ==================== 0009_active_cv.sql ====================
-- Exactly one active CV per user, swapped atomically. Idempotent: safe to run more than once.
-- Before this, two concurrent uploads (double submit, two tabs) could each deactivate the other → no active CV.

-- keep only the newest active CV per user before adding the index
update public.cvs c set is_active = false
where c.is_active and exists (
  select 1 from public.cvs d
  where d.user_id = c.user_id and d.is_active and (d.uploaded_at, d.id) > (c.uploaded_at, c.id)
);
create unique index if not exists cvs_one_active_per_user on public.cvs (user_id) where is_active;

create or replace function public.activate_cv(p_cv uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  -- serialise concurrent swaps for the same user; the last one wins
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  update public.cvs set is_active = false where user_id = auth.uid() and is_active and id <> p_cv;
  update public.cvs set is_active = true where id = p_cv and user_id = auth.uid();
  if not found then raise exception 'activate_cv: cv % not found', p_cv; end if;
end $$;
revoke execute on function public.activate_cv(uuid) from public, anon;
grant execute on function public.activate_cv(uuid) to authenticated;

commit;

-- Sanity check (should return 6 rows of 'ok')
select 'workday ats' as check, case when pg_get_constraintdef(oid) like '%workday%' then 'ok' else 'MISSING' end from pg_constraint where conname = 'companies_ats_check'
union all select 'jobs.rolling', case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='jobs' and column_name='rolling') then 'ok' else 'MISSING' end
union all select 'award_xp()', case when to_regprocedure('public.award_xp(uuid,int)') is not null then 'ok' else 'MISSING' end
union all select 'cv_feedback', case when to_regclass('public.cv_feedback') is not null then 'ok' else 'MISSING' end
union all select 'cv_scores policy', case when exists (select 1 from pg_policies where tablename='cv_scores' and policyname='own_insert_cv_owned') then 'ok' else 'MISSING' end
union all select 'activate_cv()', case when to_regprocedure('public.activate_cv(uuid)') is not null then 'ok' else 'MISSING' end;

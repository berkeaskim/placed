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

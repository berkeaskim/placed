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

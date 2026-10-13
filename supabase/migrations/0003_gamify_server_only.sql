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

-- 0012_autopilot.sql — Placed Autopilot (spec 2026-10-14). Applied by Berke, never by an agent.
create table if not exists public.autopilot_vault (
  user_id uuid primary key references auth.users on delete cascade,
  core jsonb not null default '{}',
  extra jsonb not null default '{}',
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.autopilot_vault enable row level security;
create policy "own_select" on public.autopilot_vault for select to authenticated using (auth.uid() = user_id);
-- No insert/update/delete policy: all writes go through server actions with the service role.

create table if not exists public.autopilot_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  job_id uuid not null references public.jobs on delete cascade,
  form jsonb not null,
  answers jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft','ready','claimed')),
  token_hash text unique,
  token_expires_at timestamptz,
  token_used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, job_id)
);
alter table public.autopilot_packs enable row level security;
create policy "own_select" on public.autopilot_packs for select to authenticated using (auth.uid() = user_id);

-- Setup completion earns XP once per user (same pattern as onboarding_complete, 0002).
drop index if exists public.xp_events_once_per_user;
create unique index xp_events_once_per_user
  on public.xp_events (user_id, type) where type in ('onboarding_complete','cv_uploaded','quiz_done','autopilot_ready');

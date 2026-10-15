-- LinkedIn profile scores (docs/research/linkedin/00-playbook.md). Idempotent: safe to run more than once.
-- One row per scoring run (history kept for a trend line). The uploaded PDF itself is never stored: only the
-- parsed profile (without email) and the score.
-- Numbered 0014: 0010 (feat/target-role), 0011 (feat/ingest-coverage), 0012 (feat/autopilot) and 0013 (feat/inbox-network) are taken.

create table if not exists public.linkedin_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  sector text not null,
  year text not null,
  total int not null,
  label text not null,
  dimensions jsonb not null,
  caps_applied text[] not null default '{}',
  fixes jsonb not null default '[]',
  rule_results jsonb not null default '[]',
  tips jsonb not null default '[]',
  meta jsonb not null default '{}',
  profile_json jsonb not null,
  text_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists linkedin_scores_user_sector on public.linkedin_scores (user_id, sector, created_at desc);

alter table public.linkedin_scores enable row level security;
drop policy if exists "own_select" on public.linkedin_scores;
drop policy if exists "own_insert" on public.linkedin_scores;
drop policy if exists "own_delete" on public.linkedin_scores;
create policy "own_select" on public.linkedin_scores for select to authenticated using (auth.uid() = user_id);
create policy "own_insert" on public.linkedin_scores for insert to authenticated with check (auth.uid() = user_id);
create policy "own_delete" on public.linkedin_scores for delete to authenticated using (auth.uid() = user_id);
-- No update policy: a rescore inserts a new row.

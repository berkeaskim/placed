-- Target Role mode (spec §15).

-- A student's plan/done state per Role Playbook action (ids like PB-DAT-P01, from lib/playbooks/data.json).
create table if not exists public.playbook_progress (
  user_id uuid not null references auth.users on delete cascade,
  action_id text not null check (action_id ~ '^PB-[A-Z]+-[A-Z][0-9]+$'),
  status text not null check (status in ('planned','done')),
  evidence_note text,
  evidence_url text check (evidence_url is null or evidence_url ~ '^https://'),
  updated_at timestamptz not null default now(),
  primary key (user_id, action_id),
  -- "done" is the student's own statement of what they did; it is what lets the item reach tailoring.
  constraint done_needs_evidence check (status <> 'done' or length(trim(coalesce(evidence_note, ''))) >= 10)
);
alter table public.playbook_progress enable row level security;
create policy "own_select" on public.playbook_progress for select to authenticated using (auth.uid() = user_id);
create policy "own_insert" on public.playbook_progress for insert to authenticated with check (auth.uid() = user_id);
create policy "own_update" on public.playbook_progress for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_delete" on public.playbook_progress for delete to authenticated using (auth.uid() = user_id);

-- XP for playbook actions is awarded once per action: the event row carries the action id.
alter table public.xp_events add column if not exists ref text;
create unique index if not exists xp_events_once_per_ref
  on public.xp_events (user_id, type, ref) where ref is not null;

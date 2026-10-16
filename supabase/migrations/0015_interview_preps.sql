-- 0015: shared interview prep packs, cached per company + role family. Written by the service role only.
create table if not exists public.interview_preps (
  company_id int not null references public.companies on delete cascade,
  role_key text not null,
  pack jsonb not null,
  sources jsonb not null default '[]',
  grounded boolean not null,
  model_id text not null,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  primary key (company_id, role_key)
);
create index if not exists interview_preps_created_by_idx on public.interview_preps (created_by, created_at);
alter table public.interview_preps enable row level security;
drop policy if exists "auth_read" on public.interview_preps;
create policy "auth_read" on public.interview_preps for select to authenticated using (true);

create type year_t as enum ('1st','2nd','penultimate','final','masters');
create type app_status as enum ('saved','applied','interview','offer','rejected');

create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text,
  year year_t,
  field text,
  location_pref text[] not null default '{}',
  needs_visa boolean not null default false,
  target_archetype text,
  archetypes jsonb not null default '[]',
  skills text[] not null default '{}',
  onboarded boolean not null default false,
  xp int not null default 0,
  level int not null default 1,
  streak_days int not null default 0,
  last_active_date date,
  created_at timestamptz not null default now()
);

create table public.cvs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  storage_path text not null,
  file_size int not null,
  page_count int not null,
  raw_text text not null,
  page_texts text[] not null default '{}',
  parsed_json jsonb not null,
  is_active boolean not null default true,
  uploaded_at timestamptz not null default now()
);

create table public.cv_scores (
  id uuid primary key default gen_random_uuid(),
  cv_id uuid not null references public.cvs on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  sector text not null,
  total int not null,
  dimensions jsonb not null,
  caps_applied text[] not null default '{}',
  rule_results jsonb not null,
  fixes jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (cv_id, sector)
);

create table public.confirmed_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  claim text not null,
  source text not null default 'user-stated',
  created_at timestamptz not null default now()
);

create table public.companies (
  id serial primary key,
  slug text not null,
  name text not null,
  ats text not null check (ats in ('greenhouse','lever','ashby')),
  api_host text,
  enabled boolean not null default true,
  unique (ats, slug)
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id int not null references public.companies on delete cascade,
  ext_id text not null,
  title text not null,
  url text not null,
  location text not null default '',
  remote boolean not null default false,
  deadline date,
  posted_at timestamptz,
  archetype text,
  field_tags text[] not null default '{}',
  year_eligibility text[] not null default '{}',
  sponsors_visa text not null default 'unknown' check (sponsors_visa in ('yes','no','unknown')),
  employment_type text not null default 'internship',
  first_year_friendly boolean not null default false,
  cohort_clash boolean not null default false,
  requirements jsonb not null default '[]',
  skills text[] not null default '{}',
  summary text not null default '',
  raw_html text not null default '',
  text_lines text[] not null default '{}',
  fingerprint text,
  content_hash text,
  tag_status text not null default 'pending' check (tag_status in ('ok','failed','pending')),
  is_live boolean not null default true,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique (company_id, ext_id)
);
create index jobs_live_idx on public.jobs (is_live, deadline);

create table public.matches (
  user_id uuid not null references auth.users on delete cascade,
  job_id uuid not null references public.jobs on delete cascade,
  explanation_json jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  job_id uuid not null references public.jobs on delete cascade,
  status app_status not null default 'saved',
  tailored_json jsonb,
  tailored_cv_path text,
  verify_report jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create table public.xp_events (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  type text not null,
  xp int not null,
  job_id uuid references public.jobs on delete set null,
  created_at timestamptz not null default now()
);

create table public.badges (
  user_id uuid not null references auth.users on delete cascade,
  badge_key text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_key)
);

create table public.ingest_state (
  id int primary key default 1,
  cursor int not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.ingest_state (id) values (1);

-- RLS
alter table public.profiles enable row level security;
alter table public.cvs enable row level security;
alter table public.cv_scores enable row level security;
alter table public.confirmed_facts enable row level security;
alter table public.companies enable row level security;
alter table public.jobs enable row level security;
alter table public.matches enable row level security;
alter table public.applications enable row level security;
alter table public.xp_events enable row level security;
alter table public.badges enable row level security;
alter table public.ingest_state enable row level security;

do $$
declare t text;
begin
  foreach t in array array['profiles','cvs','cv_scores','confirmed_facts','matches','applications','xp_events','badges'] loop
    execute format('create policy "own_select" on public.%I for select to authenticated using (auth.uid() = user_id)', t);
    execute format('create policy "own_insert" on public.%I for insert to authenticated with check (auth.uid() = user_id)', t);
    execute format('create policy "own_update" on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "own_delete" on public.%I for delete to authenticated using (auth.uid() = user_id)', t);
  end loop;
end $$;

create policy "public_read" on public.companies for select to anon, authenticated using (true);
create policy "public_read" on public.jobs for select to anon, authenticated using (true);

-- profile row on signup
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- private buckets (server-side access only, service role)
insert into storage.buckets (id, name, public) values ('cvs','cvs', false), ('tailored','tailored', false);

-- Inbox Agent + Networking (spec docs/superpowers/specs/2026-10-14-inbox-agent-networking-design.md).
-- Supabase grants ALL on new public tables to anon/authenticated by default, so every table below revokes first
-- and grants back only what the app contract allows.

-- 1. Gmail connection: service role only. The refresh token is AES-256-GCM ciphertext (lib/gmail/crypto.ts).
create table public.gmail_connections (
  user_id uuid primary key references auth.users on delete cascade,
  google_email text not null,
  refresh_token_enc text not null,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz
);
alter table public.gmail_connections enable row level security;
revoke all on public.gmail_connections from anon, authenticated;

-- 2. Inbox events: the user reads their own; only the service role writes.
create type public.inbox_kind as enum ('received', 'assessment', 'interview', 'offer', 'rejection', 'other');
create type public.inbox_effect as enum ('moved', 'suggested', 'none', 'undone');

create table public.inbox_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  gmail_message_id text not null,
  application_id uuid references public.applications on delete set null,
  company text,
  subject text not null,
  received_at timestamptz not null,
  kind public.inbox_kind not null,
  deadline date,
  action_url text,
  confidence real not null check (confidence >= 0 and confidence <= 1),
  effect public.inbox_effect not null,
  prev_status public.app_status,
  new_status public.app_status,
  created_at timestamptz not null default now(),
  unique (user_id, gmail_message_id)
);
create index inbox_events_user_app on public.inbox_events (user_id, application_id);
alter table public.inbox_events enable row level security;
revoke all on public.inbox_events from anon, authenticated;
grant select on public.inbox_events to authenticated;
create policy "own_select" on public.inbox_events for select to authenticated using (auth.uid() = user_id);

-- 3. Deadline/last-email columns: written by the service role during sync. Deliberately NOT added to the
-- authenticated column grant in 0008, so a user cannot forge a deadline.
alter table public.applications
  add column next_deadline date,
  add column last_event_at timestamptz;

-- 4. Outreach drafts: the user reads and creates their own, and may only change status/updated_at.
create type public.outreach_target as enum ('alumni', 'recent_joiner', 'team', 'recruiter');
create type public.outreach_status as enum ('drafted', 'sent', 'replied');

create table public.outreach (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  application_id uuid references public.applications on delete set null,
  job_id uuid references public.jobs on delete set null,
  company text not null,
  target public.outreach_target not null,
  recipient_name text check (recipient_name is null or char_length(recipient_name) <= 60),
  body text not null check (char_length(body) <= 4000),
  status public.outreach_status not null default 'drafted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index outreach_user_job on public.outreach (user_id, job_id);
alter table public.outreach enable row level security;
revoke all on public.outreach from anon, authenticated;
grant select, insert on public.outreach to authenticated;
grant update (status, updated_at) on public.outreach to authenticated;
create policy "own_select" on public.outreach for select to authenticated using (auth.uid() = user_id);
create policy "own_insert" on public.outreach for insert to authenticated with check (auth.uid() = user_id);
create policy "own_update" on public.outreach for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

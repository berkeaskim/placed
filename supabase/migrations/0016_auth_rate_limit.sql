-- 0016_auth_rate_limit.sql — attempt limiter for /login and /save (lib/auth/rate-limit.ts). Applied by Berke, never by an agent.
-- Keys are SHA-256 hashes ("loginEmail:<hex>", "loginIp:<hex>"): no raw email or IP is ever stored.
-- Service role only. The app fails open until this migration is applied.
create table if not exists public.auth_attempts (
  key text not null,
  at timestamptz not null default now()
);
create index if not exists auth_attempts_key_at on public.auth_attempts (key, at);
create index if not exists auth_attempts_at on public.auth_attempts (at);
alter table public.auth_attempts enable row level security;
revoke all on public.auth_attempts from anon, authenticated;

-- Records one attempt for p_key and returns true while the key is within p_max attempts per p_window_seconds.
create or replace function public.hit_rate_limit(p_key text, p_max int, p_window_seconds int) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_key, 0));
  delete from public.auth_attempts where key = p_key and at < now() - make_interval(secs => p_window_seconds);
  delete from public.auth_attempts where at < now() - interval '1 day'; -- keys that never come back (one-off IPs)
  insert into public.auth_attempts (key) values (p_key);
  return (select count(*) from public.auth_attempts where key = p_key) <= p_max;
end $$;
revoke execute on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;

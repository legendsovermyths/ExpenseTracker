-- Follow-ups from the security review (docs/SECURITY.md).
--
-- 1. send-push: the function now only accepts the key the notifications
--    trigger sends (Vault `service_role_key`), checked here so the value
--    never leaves the database.
-- 3. profiles: other users see only id + name. Email and phone are never
--    readable over the API (the app reads your own from the auth session).
-- 4. push_tokens: a device token belongs to one account at a time, so a
--    phone handed to someone else stops getting the old account's pushes.
-- 5. send-mail: per-user daily quota.

-- ── 1. send-push caller check ────────────────────────────────────────────

create or replace function public.is_push_webhook_key(p_key text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets s
    where s.name = 'service_role_key' and s.decrypted_secret = p_key
  );
$$;
revoke all on function public.is_push_webhook_key(text) from public, anon, authenticated;
grant execute on function public.is_push_webhook_key(text) to service_role;

-- ── 3. profiles: names only ──────────────────────────────────────────────

revoke select on public.profiles from anon, authenticated;
grant select (id, full_name, created_at) on public.profiles to authenticated;

-- ── 4. push tokens: one account per device ───────────────────────────────

create or replace function public.register_push_token(p_token text, p_platform text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_token is null or p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,}\]$' then
    raise exception 'invalid push token' using errcode = '22023';
  end if;

  delete from public.push_tokens where token = p_token and user_id <> auth.uid();

  insert into public.push_tokens (user_id, token, platform, updated_at)
  values (auth.uid(), p_token, left(coalesce(p_platform, ''), 16), now())
  on conflict (user_id, token) do update
    set platform = excluded.platform, updated_at = excluded.updated_at;
end;
$$;
revoke all on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

-- ── 5. send-mail quota ───────────────────────────────────────────────────

create table if not exists private.mail_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0,
  primary key (user_id, day)
);
revoke all on private.mail_usage from public, anon, authenticated;

create or replace function public.mail_consume_quota(p_user uuid, p_limit integer)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  ok boolean;
begin
  insert into private.mail_usage as u (user_id, day, count)
  values (p_user, current_date, 1)
  on conflict (user_id, day) do update
    set count = u.count + 1
    where u.count < p_limit
  returning true into ok;
  return coalesce(ok, false);
end;
$$;
revoke all on function public.mail_consume_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.mail_consume_quota(uuid, integer) to service_role;

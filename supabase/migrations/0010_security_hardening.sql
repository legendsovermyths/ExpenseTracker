-- Security hardening: who can see and change what.
--
-- Rules (see docs/SECURITY.md):
--   * A split (ledger_entry + line_item) is visible to, and editable /
--     deletable by, its creator, its participants, and members of its group.
--     Nobody else can see it exists.
--   * Only a split's creator can add a new person to it. Other participants
--     edit the existing people's lines; in a group split anyone can add a
--     group member.
--   * Groups: any member can rename, delete and add members.
--   * Funds: owner + other participant. Only the owner can change who the
--     other participant is.
--   * Profiles: yourself + anyone you share a split, group or fund with.
--     People are added by QR; profile_name(id) resolves a scanned QR's name.
--
-- Sync pushes whole batches with upserts (INSERT … ON CONFLICT DO UPDATE),
-- and Postgres checks the INSERT policy even when the row exists, so every
-- INSERT policy also admits people who can already access the row. Ownership
-- columns are pinned by triggers that quietly keep the old value instead of
-- raising: a stale client must never wedge a whole sync batch.
--
-- Helpers live in `private`, which PostgREST doesn't expose, so they can't
-- be called over /rpc. They read auth.uid() themselves and take no user id.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create index if not exists line_item_user_idx on public.line_item (user_id);
create index if not exists fund_owner_idx on public.fund (owner_id);
create index if not exists fund_other_idx on public.fund (other_participant_id);

-- ── helpers ──────────────────────────────────────────────────────────────

create or replace function private.is_grp_member(gid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.grp_member m
    where m.grp_id = gid and m.user_id = auth.uid() and not m.is_deleted
  );
$$;

create or replace function private.is_grp_creator(gid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.grp g where g.id = gid and g.created_by = auth.uid());
$$;

-- Current or former member: a removed member still syncs the removal.
create or replace function private.was_grp_member(gid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.grp_member m where m.grp_id = gid and m.user_id = auth.uid()
  );
$$;

create or replace function private.can_access_entry(eid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.ledger_entry le
    where le.id = eid
      and (
        le.created_by = auth.uid()
        or exists (
          select 1 from public.line_item li
          where li.entry_id = le.id and li.user_id = auth.uid()
        )
        or (
          le.grp_id is not null
          and exists (
            select 1 from public.grp_member m
            where m.grp_id = le.grp_id and m.user_id = auth.uid() and not m.is_deleted
          )
        )
      )
  );
$$;

create or replace function private.created_entry(eid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.ledger_entry le where le.id = eid and le.created_by = auth.uid()
  );
$$;

-- May the caller write a line for `uid` on entry `eid`? Their own line, an
-- entry they created, a person already on the entry, or a member of the
-- entry's group.
create or replace function private.can_write_line(eid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.can_access_entry(eid)
    and (
      uid = auth.uid()
      or private.created_entry(eid)
      or exists (
        select 1 from public.line_item li where li.entry_id = eid and li.user_id = uid
      )
      or exists (
        select 1
        from public.ledger_entry le
        join public.grp_member m on m.grp_id = le.grp_id
        where le.id = eid and m.user_id = uid and not m.is_deleted
      )
    );
$$;

create or replace function private.is_fund_party(fid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.fund f
    where f.id = fid and auth.uid() in (f.owner_id, f.other_participant_id)
  );
$$;

create or replace function private.shares_with(other uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select
    exists (
      select 1 from public.line_item a
      join public.line_item b on b.entry_id = a.entry_id
      where a.user_id = auth.uid() and b.user_id = other
    )
    or exists (
      select 1 from public.ledger_entry le
      join public.line_item b on b.entry_id = le.id
      where le.created_by = auth.uid() and b.user_id = other
    )
    or exists (
      select 1 from public.ledger_entry le
      join public.line_item a on a.entry_id = le.id
      where le.created_by = other and a.user_id = auth.uid()
    )
    or exists (
      select 1 from public.grp_member a
      join public.grp_member b on b.grp_id = a.grp_id
      where a.user_id = auth.uid() and b.user_id = other
    )
    or exists (
      select 1 from public.grp g
      join public.grp_member m on m.grp_id = g.id
      where (g.created_by = auth.uid() and m.user_id = other)
         or (g.created_by = other and m.user_id = auth.uid())
    )
    or exists (
      select 1 from public.fund f
      where (f.owner_id = auth.uid() and f.other_participant_id = other)
         or (f.other_participant_id = auth.uid() and f.owner_id = other)
    );
$$;

create or replace function private.my_balance_pairs()
returns table (user_lo uuid, user_hi uuid, net_cents bigint)
language sql stable security definer set search_path = ''
as $$
  select bp.user_lo, bp.user_hi, bp.net_cents
  from public.balance_pair bp
  where bp.user_lo = auth.uid() or bp.user_hi = auth.uid();
$$;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to anon, authenticated, service_role;

-- ── ownership pins ───────────────────────────────────────────────────────

create or replace function private.pin_ledger_entry_owner()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.created_by := old.created_by;
  new.grp_id := old.grp_id;
  return new;
end;
$$;

drop trigger if exists pin_ledger_entry_owner on public.ledger_entry;
create trigger pin_ledger_entry_owner
  before update on public.ledger_entry
  for each row execute function private.pin_ledger_entry_owner();

create or replace function private.pin_grp_owner()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.created_by := old.created_by;
  return new;
end;
$$;

drop trigger if exists pin_grp_owner on public.grp;
create trigger pin_grp_owner
  before update on public.grp
  for each row execute function private.pin_grp_owner();

create or replace function private.pin_fund_owner()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.owner_id := old.owner_id;
  if auth.uid() is distinct from old.owner_id then
    new.other_participant_id := old.other_participant_id;
  end if;
  return new;
end;
$$;

drop trigger if exists pin_fund_owner on public.fund;
create trigger pin_fund_owner
  before update on public.fund
  for each row execute function private.pin_fund_owner();

-- ── ledger_entry ─────────────────────────────────────────────────────────
-- `created_by = auth.uid()` stays inline: the creator's own RETURNING row is
-- checked inside the inserting statement, before the helper can see it.

drop policy if exists "ledger_entry_select_policy" on public.ledger_entry;
create policy "ledger_entry_select_policy" on public.ledger_entry
  for select to authenticated
  using (created_by = auth.uid() or private.can_access_entry(id));

drop policy if exists "ledger_entry_insert_policy" on public.ledger_entry;
create policy "ledger_entry_insert_policy" on public.ledger_entry
  for insert to authenticated
  with check (
    (
      created_by = auth.uid()
      and (grp_id is null or private.is_grp_member(grp_id) or private.is_grp_creator(grp_id))
    )
    or private.can_access_entry(id)
  );

drop policy if exists "ledger_entry_update_policy" on public.ledger_entry;
create policy "ledger_entry_update_policy" on public.ledger_entry
  for update to authenticated
  using (created_by = auth.uid() or private.can_access_entry(id))
  with check (created_by = auth.uid() or private.can_access_entry(id));

drop policy if exists "ledger_entry_delete_policy" on public.ledger_entry;
create policy "ledger_entry_delete_policy" on public.ledger_entry
  for delete to authenticated
  using (created_by = auth.uid() or private.can_access_entry(id));

-- ── line_item ────────────────────────────────────────────────────────────

drop policy if exists "line_item_select_policy" on public.line_item;
create policy "line_item_select_policy" on public.line_item
  for select to authenticated
  using (private.can_access_entry(entry_id));

drop policy if exists "line_item_insert_policy" on public.line_item;
create policy "line_item_insert_policy" on public.line_item
  for insert to authenticated
  with check (private.can_write_line(entry_id, user_id));

drop policy if exists "line_item_update_policy" on public.line_item;
create policy "line_item_update_policy" on public.line_item
  for update to authenticated
  using (private.can_access_entry(entry_id))
  with check (private.can_write_line(entry_id, user_id));

drop policy if exists "line_item_delete_policy" on public.line_item;
create policy "line_item_delete_policy" on public.line_item
  for delete to authenticated
  using (private.can_access_entry(entry_id));

-- ── grp / grp_member ─────────────────────────────────────────────────────

drop policy if exists "grp_select" on public.grp;
create policy "grp_select" on public.grp
  for select to authenticated
  using (created_by = auth.uid() or private.was_grp_member(id));

drop policy if exists "grp_insert" on public.grp;
create policy "grp_insert" on public.grp
  for insert to authenticated
  with check (created_by = auth.uid() or private.is_grp_member(id));

drop policy if exists "grp_update" on public.grp;
create policy "grp_update" on public.grp
  for update to authenticated
  using (created_by = auth.uid() or private.is_grp_member(id))
  with check (created_by = auth.uid() or private.is_grp_member(id));

drop policy if exists "grp_member_select" on public.grp_member;
create policy "grp_member_select" on public.grp_member
  for select to authenticated
  using (
    user_id = auth.uid()
    or private.is_grp_member(grp_id)
    or private.is_grp_creator(grp_id)
  );

drop policy if exists "grp_member_insert" on public.grp_member;
create policy "grp_member_insert" on public.grp_member
  for insert to authenticated
  with check (private.is_grp_creator(grp_id) or private.is_grp_member(grp_id));

drop policy if exists "grp_member_update" on public.grp_member;
create policy "grp_member_update" on public.grp_member
  for update to authenticated
  using (private.is_grp_creator(grp_id) or private.is_grp_member(grp_id))
  with check (private.is_grp_creator(grp_id) or private.is_grp_member(grp_id));

-- ── fund / fund_entry ────────────────────────────────────────────────────

drop policy if exists "fund_participant_select" on public.fund;
create policy "fund_participant_select" on public.fund
  for select to authenticated
  using (auth.uid() in (owner_id, other_participant_id));

drop policy if exists "fund_owner_insert" on public.fund;
create policy "fund_owner_insert" on public.fund
  for insert to authenticated
  with check (owner_id = auth.uid() or private.is_fund_party(id));

drop policy if exists "fund_participant_update" on public.fund;
create policy "fund_participant_update" on public.fund
  for update to authenticated
  using (auth.uid() in (owner_id, other_participant_id))
  with check (auth.uid() in (owner_id, other_participant_id));

drop policy if exists "fund_entry_participant_select" on public.fund_entry;
create policy "fund_entry_participant_select" on public.fund_entry
  for select to authenticated
  using (private.is_fund_party(fund_id));

drop policy if exists "fund_entry_contributor_insert" on public.fund_entry;
create policy "fund_entry_contributor_insert" on public.fund_entry
  for insert to authenticated
  with check (contributor_id = auth.uid() and private.is_fund_party(fund_id));

drop policy if exists "fund_entry_contributor_update" on public.fund_entry;
create policy "fund_entry_contributor_update" on public.fund_entry
  for update to authenticated
  using (contributor_id = auth.uid())
  with check (contributor_id = auth.uid() and private.is_fund_party(fund_id));

-- ── profiles ─────────────────────────────────────────────────────────────

drop policy if exists "Allow authenticated read" on public.profiles;
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or private.shares_with(id));

-- Name for a scanned friend QR (the QR's own name could be spoofed).
create or replace function public.profile_name(pid uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select p.full_name from public.profiles p where p.id = pid;
$$;
revoke all on function public.profile_name(uuid) from public, anon;
grant execute on function public.profile_name(uuid) to authenticated, service_role;

-- ── notifications / push_tokens: scope to signed-in users ────────────────

drop policy if exists "notifications_owner_select" on public.notifications;
create policy "notifications_owner_select" on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications_owner_update" on public.notifications;
create policy "notifications_owner_update" on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "push_tokens_owner_rw" on public.push_tokens;
create policy "push_tokens_owner_rw" on public.push_tokens
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── balances ─────────────────────────────────────────────────────────────

create or replace view public.balance_pair_me with (security_invoker = on) as
  select user_lo, user_hi, net_cents from private.my_balance_pairs();
revoke all on public.balance_pair_me from anon;
grant select on public.balance_pair_me to authenticated;

-- ── AI quota (used by the `ai` Edge Function with the service role) ──────

create table if not exists private.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0,
  primary key (user_id, day)
);
revoke all on private.ai_usage from public, anon, authenticated;

create or replace function public.ai_consume_quota(p_user uuid, p_limit integer)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  ok boolean;
begin
  insert into private.ai_usage as u (user_id, day, count)
  values (p_user, current_date, 1)
  on conflict (user_id, day) do update
    set count = u.count + 1
    where u.count < p_limit
  returning true into ok;
  return coalesce(ok, false);
end;
$$;
revoke all on function public.ai_consume_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.ai_consume_quota(uuid, integer) to service_role;

-- ── hygiene ──────────────────────────────────────────────────────────────

-- Old helpers took any user id and were callable over /rpc; replaced above.
drop function if exists public.user_can_access_entry(uuid, uuid);
drop function if exists public.user_created_entry(text, text);
drop function if exists public.user_created_entry(text, uuid);
drop function if exists public.user_created_entry(uuid, uuid);
drop function if exists public.user_participates_in_entry(text, text);
drop function if exists public.user_participates_in_entry(text, uuid);
drop function if exists public.user_participates_in_entry(uuid, uuid);
drop function if exists public.user_in_entry(uuid);
drop function if exists public.is_grp_member(uuid, uuid);
drop function if exists public.is_grp_creator(uuid, uuid);

-- Trigger functions: never meant to be called directly. Triggers still fire
-- (EXECUTE is only checked when a trigger is created).
revoke execute on function public.bump_balance_pair() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.notify_fund_created() from public, anon, authenticated;
revoke execute on function public.notify_fund_participant() from public, anon, authenticated;
revoke execute on function public.notify_grp_member_added() from public, anon, authenticated;
revoke execute on function public.notify_split_participants() from public, anon, authenticated;
revoke execute on function public.refresh_balance_pair_trg() from public, anon, authenticated;
revoke execute on function public.refresh_balance_mv() from public, anon, authenticated;
revoke execute on function public.trigger_send_push() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.touch_last_modified() from public, anon, authenticated;

alter function public.bump_balance_pair() set search_path = public;
alter function public.refresh_balance_mv() set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public.touch_last_modified() set search_path = public;

-- TRUNCATE ignores RLS; nobody but the owner needs it.
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;

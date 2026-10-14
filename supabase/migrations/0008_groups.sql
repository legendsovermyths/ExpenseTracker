-- Group splits.
--
-- grp / grp_member / ledger_entry.grp_id already existed (created by hand
-- in the dashboard) but were only half-wired: no insert/update policies,
-- members couldn't see each other, no updated_at for incremental sync, and
-- balance_pair only produced correct numbers for two-person entries.

-- ── 1. sync columns ─────────────────────────────────────────────────────
alter table grp add column if not exists updated_at timestamptz not null default now();
alter table grp add column if not exists is_deleted boolean not null default false;
alter table grp_member add column if not exists updated_at timestamptz not null default now();
alter table grp_member add column if not exists is_deleted boolean not null default false;

drop trigger if exists touch_grp_updated_at on grp;
create trigger touch_grp_updated_at
  before update on grp
  for each row execute function set_updated_at();

drop trigger if exists touch_grp_member_updated_at on grp_member;
create trigger touch_grp_member_updated_at
  before update on grp_member
  for each row execute function set_updated_at();

create index if not exists grp_member_user_idx on grp_member(user_id);
create index if not exists ledger_entry_grp_idx on ledger_entry(grp_id);

-- ── 2. RLS ──────────────────────────────────────────────────────────────
-- SECURITY DEFINER helpers so grp_member's policies can look at grp_member
-- without recursing into themselves.
create or replace function is_grp_member(gid uuid, uid uuid)
returns boolean
language sql
security definer
stable
set search_path to 'public'
as $$
  select exists (
    select 1 from grp_member m
    where m.grp_id = gid and m.user_id = uid and not m.is_deleted
  );
$$;

create or replace function is_grp_creator(gid uuid, uid uuid)
returns boolean
language sql
security definer
stable
set search_path to 'public'
as $$
  select exists (select 1 from grp g where g.id = gid and g.created_by = uid);
$$;

-- grp: creator or (current/former) member can read; creator inserts;
-- any active member can rename / soft-delete.
drop policy if exists "grp_select" on grp;
create policy "grp_select" on grp
  for select
  using (
    created_by = auth.uid()
    or exists (select 1 from grp_member m where m.grp_id = grp.id and m.user_id = auth.uid())
  );

-- The app syncs with upserts (INSERT ... ON CONFLICT DO UPDATE), and
-- Postgres applies the INSERT check even when the row already exists — so
-- members (not just the creator) must pass it to rename / delete. A brand-new
-- group has no members yet, so only its creator can insert it.
drop policy if exists "grp_insert" on grp;
create policy "grp_insert" on grp
  for insert
  with check (created_by = auth.uid() or is_grp_member(id, auth.uid()));

drop policy if exists "grp_update" on grp;
create policy "grp_update" on grp
  for update
  using (created_by = auth.uid() or is_grp_member(id, auth.uid()))
  with check (created_by = auth.uid() or is_grp_member(id, auth.uid()));

-- grp_member: see every member of a group you belong to (or were removed
-- from, so the removal itself syncs down); creator or any active member
-- can add / remove members.
drop policy if exists "grp_member_select" on grp_member;
create policy "grp_member_select" on grp_member
  for select
  using (
    user_id = auth.uid()
    or is_grp_member(grp_id, auth.uid())
    or is_grp_creator(grp_id, auth.uid())
  );

drop policy if exists "grp_member_insert" on grp_member;
create policy "grp_member_insert" on grp_member
  for insert
  with check (is_grp_creator(grp_id, auth.uid()) or is_grp_member(grp_id, auth.uid()));

drop policy if exists "grp_member_update" on grp_member;
create policy "grp_member_update" on grp_member
  for update
  using (is_grp_creator(grp_id, auth.uid()) or is_grp_member(grp_id, auth.uid()))
  with check (is_grp_creator(grp_id, auth.uid()) or is_grp_member(grp_id, auth.uid()));

-- ── 3. balances for N-person entries ────────────────────────────────────
-- Each entry's line items net to zero (amount = paid - owed). Debtors
-- (amount < 0) owe creditors (amount > 0) in proportion to each
-- creditor's share of the total credit. Two-person entries keep the
-- previous `-hi.amount_cents` formula verbatim — some legacy rows are off
-- by a rounding cent and don't net to exactly zero.
drop view if exists balance_pair_me;
drop materialized view if exists balance_pair;

create materialized view balance_pair as
with entry_credit as (
  select
    li.entry_id,
    count(*) as n,
    sum(li.amount_cents) filter (where li.amount_cents > 0) as credit
  from line_item li
  join ledger_entry le on le.id = li.entry_id
  where coalesce(le.is_deleted, false) = false
  group by li.entry_id
)
select
  lo.user_id as user_lo,
  hi.user_id as user_hi,
  -- positive ⇒ user_hi owes user_lo. Rounded per entry, matching the
  -- app's per-entry `pairwiseNet`.
  sum(round(
    case
      when ec.n = 2 then -hi.amount_cents::numeric
      when ec.credit is null or ec.credit = 0 then 0
      when lo.amount_cents > 0 and hi.amount_cents < 0
        then -hi.amount_cents::numeric * lo.amount_cents / ec.credit
      when lo.amount_cents < 0 and hi.amount_cents > 0
        then lo.amount_cents::numeric * hi.amount_cents / ec.credit
      else 0
    end
  ))::bigint as net_cents
from line_item lo
join line_item hi on hi.entry_id = lo.entry_id and hi.user_id > lo.user_id
join entry_credit ec on ec.entry_id = lo.entry_id
group by lo.user_id, hi.user_id;

create unique index balance_pair_uidx on balance_pair(user_lo, user_hi);

-- Materialized views can't have RLS, and Supabase's default privileges grant
-- new relations to anon/authenticated — keep the raw all-users table private;
-- clients go through balance_pair_me.
revoke all on balance_pair from anon, authenticated;

create view balance_pair_me as
  select user_lo, user_hi, net_cents
  from balance_pair
  where user_lo = auth.uid() or user_hi = auth.uid();

grant select on balance_pair_me to authenticated;

-- Editing a split upserts line_items (UPDATE, not INSERT) after the
-- ledger_entry row — refresh on those too so edited group expenses (and
-- 1:1 ones) are reflected immediately.
drop trigger if exists refresh_balance_pair_after_li_change on line_item;
create trigger refresh_balance_pair_after_li_change
  after update or delete on line_item
  for each statement execute function bump_balance_pair();

-- ── 4. notifications ────────────────────────────────────────────────────
-- Tell a user when someone else adds them to a group.
create or replace function notify_grp_member_added()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  g record;
begin
  select id, name, created_by into g from grp where id = new.grp_id;
  if auth.uid() is null or new.user_id = auth.uid() or new.is_deleted then
    return new;
  end if;

  insert into notifications (user_id, type, actor_id, payload)
  values (
    new.user_id,
    'group_added',
    auth.uid(),
    jsonb_build_object('grp_id', g.id, 'group_name', g.name)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_grp_member_added on grp_member;
create trigger trg_notify_grp_member_added
  after insert on grp_member
  for each row execute function notify_grp_member_added();

-- Include the group name in split notifications so the push can say
-- "in Goa trip".
create or replace function notify_split_participants()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  entry record;
begin
  select le.id, le.description, le.total_cents, le.created_by, le.kind, le.grp_id, g.name as grp_name
    into entry
    from ledger_entry le
    left join grp g on g.id = le.grp_id
    where le.id = new.entry_id;

  if entry.created_by is null or entry.created_by = new.user_id then
    return new;
  end if;

  -- Group members left out of an expense are stored as zero line items.
  if coalesce(new.paid_cents, 0) = 0 and coalesce(new.owed_cents, 0) = 0 then
    return new;
  end if;

  insert into notifications (user_id, type, actor_id, payload)
  values (
    new.user_id,
    case when entry.kind = 'PAYMENT' then 'split_payment' else 'split_added' end,
    entry.created_by,
    jsonb_build_object(
      'entry_id', entry.id,
      'description', entry.description,
      'amount_cents', new.amount_cents,
      'grp_id', entry.grp_id,
      'group_name', entry.grp_name
    )
  );

  return new;
end;
$$;

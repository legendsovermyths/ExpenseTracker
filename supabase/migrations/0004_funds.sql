-- Fund feature: shared/individual money pools. First fully-migration-tracked
-- pair of core tables in this project (ledger_entry/line_item predate the
-- migrations folder — see supabase/README.md). Local SQLite mirrors this
-- exact shape (sdk/src/services/database.rs), reconciled via the same
-- is_dirty/updated_at pattern splits already use.

create table if not exists fund (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon_name text,
  icon_type text,
  is_shared boolean not null default false,
  owner_id uuid not null references auth.users(id) on delete cascade,
  other_participant_id uuid references auth.users(id) on delete set null,
  target_cents bigint,
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false
);

create table if not exists fund_entry (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references fund(id) on delete cascade,
  contributor_id uuid not null references auth.users(id) on delete cascade,
  amount_cents bigint not null,
  direction text not null check (direction in ('CONTRIBUTION', 'WITHDRAWAL')),
  note text,
  linked_transaction_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false
);

alter table fund enable row level security;
alter table fund_entry enable row level security;

create index if not exists idx_fund_updated on fund(updated_at);
create index if not exists idx_fund_entry_fund_updated on fund_entry(fund_id, updated_at);

-- fund: visible/editable by owner or the other participant (if shared).
drop policy if exists "fund_participant_select" on fund;
create policy "fund_participant_select" on fund
  for select
  using (auth.uid() = owner_id or auth.uid() = other_participant_id);

drop policy if exists "fund_owner_insert" on fund;
create policy "fund_owner_insert" on fund
  for insert
  with check (auth.uid() = owner_id);

drop policy if exists "fund_participant_update" on fund;
create policy "fund_participant_update" on fund
  for update
  using (auth.uid() = owner_id or auth.uid() = other_participant_id)
  with check (auth.uid() = owner_id or auth.uid() = other_participant_id);

-- fund_entry: visible to either party of the parent fund; insertable/
-- updatable only as yourself, into a fund you belong to.
drop policy if exists "fund_entry_participant_select" on fund_entry;
create policy "fund_entry_participant_select" on fund_entry
  for select
  using (exists (
    select 1 from fund f where f.id = fund_entry.fund_id
      and (auth.uid() = f.owner_id or auth.uid() = f.other_participant_id)
  ));

drop policy if exists "fund_entry_contributor_insert" on fund_entry;
create policy "fund_entry_contributor_insert" on fund_entry
  for insert
  with check (
    auth.uid() = contributor_id
    and exists (
      select 1 from fund f where f.id = fund_entry.fund_id
        and (auth.uid() = f.owner_id or auth.uid() = f.other_participant_id)
    )
  );

drop policy if exists "fund_entry_contributor_update" on fund_entry;
create policy "fund_entry_contributor_update" on fund_entry
  for update
  using (auth.uid() = contributor_id)
  with check (auth.uid() = contributor_id);

-- Notification fan-out — same shape as notify_split_participants()
-- (0001_notifications.sql). Rides the same notifications table, Edge
-- Function, and Realtime channel; only this trigger is Fund-specific.
create or replace function notify_fund_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  f record;
  recipient uuid;
begin
  select owner_id, other_participant_id, name into f
    from fund where id = new.fund_id;

  recipient := case when f.owner_id = new.contributor_id
                     then f.other_participant_id
                     else f.owner_id end;

  if recipient is null then
    return new; -- solo fund, no one to notify
  end if;

  insert into notifications (user_id, type, actor_id, payload)
  values (
    recipient,
    case when new.direction = 'WITHDRAWAL' then 'fund_withdrawal' else 'fund_contribution' end,
    new.contributor_id,
    jsonb_build_object(
      'fund_id', new.fund_id,
      'fund_name', f.name,
      'amount_cents', new.amount_cents
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_fund_participant on fund_entry;
create trigger trg_notify_fund_participant
  after insert on fund_entry
  for each row execute function notify_fund_participant();

-- Notification system: one table doubling as the write-side outbox and the
-- read-side inbox. See supabase/README.md for the design write-up and the
-- manual steps needed after applying this migration.

-- ---------------------------------------------------------------------------
-- push_tokens: registered on login/app start from services/Notifications.ts.
-- Write-mostly; only ever read by the send-push Edge Function.
-- ---------------------------------------------------------------------------
create table if not exists push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null,
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

alter table push_tokens enable row level security;

drop policy if exists "push_tokens_owner_rw" on push_tokens;
create policy "push_tokens_owner_rw" on push_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- notifications: per-recipient row (a 3-way kitty contribution produces one
-- row per other participant). read_at doubles as the in-app inbox's unread
-- state; push_sent_at is stamped by the Edge Function once a push actually
-- goes out, so "recorded" and "device notified" are distinguishable.
-- ---------------------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  actor_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  push_sent_at timestamptz
);

alter table notifications enable row level security;

create index if not exists idx_notifications_user_created
  on notifications (user_id, created_at desc);

drop policy if exists "notifications_owner_select" on notifications;
create policy "notifications_owner_select" on notifications
  for select
  using (auth.uid() = user_id);

-- Only read_at is ever mutated by a client; row creation happens exclusively
-- via the trigger function below (security definer), never a direct insert.
drop policy if exists "notifications_owner_update" on notifications;
create policy "notifications_owner_update" on notifications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Fan-out trigger for splits. This is the one per-feature piece — Kitty will
-- get its own trigger of this same shape when that table lands, everything
-- else (notifications table, RLS, Edge Function, Realtime channel) is shared.
-- ---------------------------------------------------------------------------
create or replace function notify_split_participants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  entry record;
begin
  select le.id, le.description, le.total_cents, le.created_by, le.kind
    into entry
    from ledger_entry le
    where le.id = new.entry_id;

  -- Don't notify the actor about their own line item, and don't notify
  -- if the entry lookup somehow failed.
  if entry.created_by is null or entry.created_by = new.user_id then
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
      'amount_cents', new.amount_cents
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_split_participants on line_item;
create trigger trg_notify_split_participants
  after insert on line_item
  for each row execute function notify_split_participants();

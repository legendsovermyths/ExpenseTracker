-- Split visibility fix.
--
-- user_participates_in_entry(entry_id uuid, user_id uuid) named its
-- parameters after line_item's columns. Inside a SQL function column names
-- win, so `line_item.entry_id = entry_id` compared the column with itself
-- and the function returned true for every entry — every user could read
-- (and update) every ledger_entry. line_item's policies were open to any
-- authenticated user outright.
--
-- Fixed by using positional parameters, and routing ledger_entry/line_item
-- access through one helper: you can see an entry if you created it, take
-- part in it, or belong to its group.

create or replace function public.user_participates_in_entry(entry_id uuid, user_id uuid)
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from line_item li where li.entry_id = $1 and li.user_id = $2
  );
$$;

create or replace function public.user_participates_in_entry(entry_id text, user_id uuid)
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from line_item li where li.entry_id::text = $1 and li.user_id = $2
  );
$$;

create or replace function public.user_can_access_entry(eid uuid, uid uuid)
returns boolean
language sql
security definer
stable
set search_path to 'public'
as $$
  select exists (
    select 1 from ledger_entry le
    where le.id = eid
      and (
        le.created_by = uid
        or exists (select 1 from line_item li where li.entry_id = le.id and li.user_id = uid)
        or (le.grp_id is not null and is_grp_member(le.grp_id, uid))
      )
  );
$$;

-- ledger_entry
drop policy if exists "ledger_entry_select_policy" on ledger_entry;
create policy "ledger_entry_select_policy" on ledger_entry
  for select
  using (created_by = auth.uid() or user_can_access_entry(id, auth.uid()));

drop policy if exists "ledger_entry_update_policy" on ledger_entry;
create policy "ledger_entry_update_policy" on ledger_entry
  for update
  using (created_by = auth.uid() or user_can_access_entry(id, auth.uid()))
  with check (created_by = auth.uid() or user_can_access_entry(id, auth.uid()));

drop policy if exists "ledger_entry_delete_policy" on ledger_entry;
create policy "ledger_entry_delete_policy" on ledger_entry
  for delete
  using (created_by = auth.uid() or user_can_access_entry(id, auth.uid()));

-- line_item (the entry row is always pushed before its line items)
drop policy if exists "line_item_select_policy" on line_item;
create policy "line_item_select_policy" on line_item
  for select
  using (user_can_access_entry(entry_id, auth.uid()));

drop policy if exists "line_item_insert_policy" on line_item;
create policy "line_item_insert_policy" on line_item
  for insert
  with check (user_can_access_entry(entry_id, auth.uid()));

drop policy if exists "line_item_update_policy" on line_item;
create policy "line_item_update_policy" on line_item
  for update
  using (user_can_access_entry(entry_id, auth.uid()))
  with check (user_can_access_entry(entry_id, auth.uid()));

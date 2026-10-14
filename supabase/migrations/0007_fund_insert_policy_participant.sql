-- Postgres enforces a table's INSERT policy WITH CHECK even when an
-- `upsert()` (INSERT ... ON CONFLICT DO UPDATE) resolves via the conflict
-- path — the UPDATE policy alone isn't consulted for that check. Since
-- fund_owner_insert only allowed auth.uid() = owner_id, a participant's
-- client batching a locally-dirty fund they don't own (alongside their own
-- genuinely-new funds, in one upsert call) got the whole batch rejected
-- with "new row violates row-level security policy for table fund" —
-- even though fund_participant_update already allows a participant to
-- update that same row. Widen the INSERT check to match the UPDATE check
-- so both paths agree.
drop policy if exists "fund_owner_insert" on fund;
create policy "fund_owner_insert" on fund
  for insert
  with check (auth.uid() = owner_id or auth.uid() = other_participant_id);

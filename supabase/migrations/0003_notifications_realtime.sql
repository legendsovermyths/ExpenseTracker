-- Adds `notifications` to Supabase's Realtime publication so
-- services/Notifications.ts's postgres_changes subscription (the foreground
-- live-update path) actually receives INSERT events. Already applied
-- directly when this was set up; tracked here so it's reproducible.
-- (ALTER PUBLICATION ... ADD TABLE errors if already a member, hence the
-- existence check rather than a bare statement.)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table notifications;
  end if;
end $$;

-- Wires the `notifications` table to the `send-push` Edge Function via
-- pg_net, replacing the dashboard "Database Webhooks" UI step entirely —
-- this is scripted so it needs no manual clicking.
--
-- The service role key itself is NOT in this file. It's stored once via
-- Supabase Vault (`select vault.create_secret(<key>, 'service_role_key', ...)`,
-- run directly against the DB, never committed) and looked up by name here.

create extension if not exists pg_net;

create or replace function public.trigger_send_push()
returns trigger
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  service_key text;
  function_url text := 'https://vxytlhgnldfjmcafcewl.supabase.co/functions/v1/send-push';
begin
  select decrypted_secret into service_key
    from vault.decrypted_secrets
    where name = 'service_role_key'
    limit 1;

  if service_key is null then
    -- Secret not seeded yet — don't fail the notification insert over it.
    return new;
  end if;

  perform net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'notifications',
      'record', row_to_json(new)
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_send_push on notifications;
create trigger trg_send_push
  after insert on notifications
  for each row execute function public.trigger_send_push();

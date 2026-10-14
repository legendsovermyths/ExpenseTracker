-- Notify the other participant the moment a shared fund is created, not
-- just on its first contribution/withdrawal (0004_funds.sql only wired the
-- fund_entry trigger). Same notifications table/Edge Function/Realtime
-- channel as every other notification type — only this trigger is new.
create or replace function notify_fund_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_shared and new.other_participant_id is not null then
    insert into notifications (user_id, type, actor_id, payload)
    values (
      new.other_participant_id,
      'fund_created',
      new.owner_id,
      jsonb_build_object('fund_id', new.id, 'fund_name', new.name)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_fund_created on fund;
create trigger trg_notify_fund_created
  after insert on fund
  for each row execute function notify_fund_created();

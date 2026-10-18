-- AI-generated icons.
--
-- An icon is one SVG path (`d` string, fill-rule evenodd) on a 24×24 grid,
-- produced on the device by the Rust SDK from a FLUX image. Storing path
-- data instead of an SVG document means there is nothing to sanitize: the
-- app always renders it as <Path d=…> inside its own <Svg>.
--
-- Categories, funds and groups point at an icon with
--   icon_type = 'custom', icon_name = '<icon uuid>'.
--
-- Who can read an icon: its owner, plus members of any group and parties
-- of any fund that uses it. Icons are immutable once created (only
-- is_deleted can change), so an owner can't alter what other people see.

create table if not exists public.icon (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  path text not null,
  prompt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false,
  constraint icon_path_shape check (
    char_length(path) between 1 and 16384
    and path ~ '^[Mm][MmLlHhVvCcSsQqTtZz0-9 .,eE+-]*$'
  ),
  constraint icon_prompt_len check (prompt is null or char_length(prompt) <= 60)
);

create index if not exists icon_owner_idx on public.icon (owner_id);

alter table public.icon enable row level security;

-- Groups get the same icon columns funds already have.
alter table public.grp add column if not exists icon_name text;
alter table public.grp add column if not exists icon_type text;
alter table public.grp drop constraint if exists grp_icon_len;
alter table public.grp add constraint grp_icon_len check (
  char_length(coalesce(icon_name, '')) <= 100 and char_length(coalesce(icon_type, '')) <= 40
);

create index if not exists grp_custom_icon_idx on public.grp (icon_name) where icon_type = 'custom';
create index if not exists fund_custom_icon_idx on public.fund (icon_name) where icon_type = 'custom';

-- ── helpers ──────────────────────────────────────────────────────────────

create or replace function private.can_see_icon(iid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select
    exists (select 1 from public.icon i where i.id = iid and i.owner_id = auth.uid())
    or exists (
      select 1 from public.grp g
      where g.icon_type = 'custom' and g.icon_name = iid::text
        and (g.created_by = auth.uid() or exists (
          select 1 from public.grp_member m where m.grp_id = g.id and m.user_id = auth.uid()
        ))
    )
    or exists (
      select 1 from public.fund f
      where f.icon_type = 'custom' and f.icon_name = iid::text
        and auth.uid() in (f.owner_id, f.other_participant_id)
    );
$$;

revoke all on function private.can_see_icon(uuid) from public;
grant execute on function private.can_see_icon(uuid) to anon, authenticated, service_role;

-- ── policies ─────────────────────────────────────────────────────────────

drop policy if exists "icon_select" on public.icon;
create policy "icon_select" on public.icon
  for select to authenticated
  using (owner_id = auth.uid() or private.can_see_icon(id));

drop policy if exists "icon_insert" on public.icon;
create policy "icon_insert" on public.icon
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "icon_update" on public.icon;
create policy "icon_update" on public.icon
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- No hard delete: a freed id could be re-inserted with different art, and
-- every group or fund pointing at it would silently change. The app only
-- ever soft-deletes.
drop policy if exists "icon_delete" on public.icon;
revoke delete, truncate, trigger, references on public.icon from anon, authenticated;
revoke all on public.icon from anon;

-- ── pins ─────────────────────────────────────────────────────────────────

-- Icons are immutable apart from soft delete (including the id, which
-- would otherwise free it for reuse); updated_at is server time.
create or replace function private.pin_icon()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.id := old.id;
  new.owner_id := old.owner_id;
  new.path := old.path;
  new.prompt := old.prompt;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists pin_icon on public.icon;
create trigger pin_icon
  before update on public.icon
  for each row execute function private.pin_icon();

-- A group or fund may only point at a custom icon the writer can already
-- see. Otherwise anyone who learned an icon's id could attach it to their
-- own group and read it. A bad reference is quietly dropped (keep the old
-- icon, or none) rather than raised, so a stale client can't wedge a sync.
create or replace function private.check_icon_ref()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  prev_type text;
  prev_name text;
  ok boolean := true;
begin
  if new.icon_type is distinct from 'custom' then
    return new;
  end if;
  -- Sync upserts run the INSERT trigger first and feed its result into the
  -- UPDATE, so look the current row up ourselves on INSERT too.
  if tg_op = 'UPDATE' then
    prev_type := old.icon_type;
    prev_name := old.icon_name;
  else
    execute format('select icon_type, icon_name from %I.%I where id = $1',
                   tg_table_schema, tg_table_name)
      into prev_type, prev_name using new.id;
  end if;
  if prev_type is not distinct from new.icon_type
     and prev_name is not distinct from new.icon_name then
    return new;
  end if;
  if new.icon_name is null
     or new.icon_name !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    ok := false;
  elsif auth.uid() is not null then
    ok := private.can_see_icon(new.icon_name::uuid);
  else
    ok := exists (select 1 from public.icon i where i.id = new.icon_name::uuid);
  end if;
  if not ok then
    new.icon_type := prev_type;
    new.icon_name := prev_name;
  end if;
  return new;
end;
$$;

revoke all on function private.check_icon_ref() from public, anon, authenticated;

drop trigger if exists check_icon_ref on public.grp;
create trigger check_icon_ref
  before insert or update on public.grp
  for each row execute function private.check_icon_ref();

drop trigger if exists check_icon_ref on public.fund;
create trigger check_icon_ref
  before insert or update on public.fund
  for each row execute function private.check_icon_ref();

-- ── icon generation quota (used by the `ai` Edge Function) ───────────────
-- Separate from the text-AI quota: image generation costs far more.

create table if not exists private.icon_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0,
  primary key (user_id, day)
);
revoke all on private.icon_usage from public, anon, authenticated;

create or replace function public.icon_consume_quota(p_user uuid, p_limit integer)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  ok boolean;
begin
  insert into private.icon_usage as u (user_id, day, count)
  values (p_user, current_date, 1)
  on conflict (user_id, day) do update
    set count = u.count + 1
    where u.count < p_limit
  returning true into ok;
  return coalesce(ok, false);
end;
$$;
revoke all on function public.icon_consume_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.icon_consume_quota(uuid, integer) to service_role;

-- Give a generation back when the image service itself failed.
create or replace function public.icon_refund_quota(p_user uuid)
returns void language sql security definer set search_path = ''
as $$
  update private.icon_usage set count = greatest(count - 1, 0)
  where user_id = p_user and day = current_date;
$$;
revoke all on function public.icon_refund_quota(uuid) from public, anon, authenticated;
grant execute on function public.icon_refund_quota(uuid) to service_role;
revoke all on function private.pin_icon() from public, anon, authenticated;

-- Background AI categorisation for "Import splits" (Settings → Import splits).
--
-- The app sends its unlinked splits here and can then be closed: the
-- `split-import` Edge Function categorises them chunk by chunk, writing each
-- chunk's results as it finishes. On next launch the app reads the finished
-- job, writes the transactions into its local SQLite in one transaction, and
-- acks the job, which deletes it (and its items, via cascade).
--
-- Category ids are the device's local SQLite ids, so a job is only ever
-- applied by the device that started it (`device_id`).
--
-- Clients can only read their own jobs. Every write goes through the Edge
-- Function with the service role.

create table if not exists public.split_import_job (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id text not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'failed')),
  account_id integer not null,
  -- [{id, name, parent_id}] — the device's categories at start time.
  categories jsonb not null default '[]'::jsonb,
  merchants text not null default '',
  -- [{key, name, parent_id, icon}] — new categories the model proposed.
  new_categories jsonb not null default '[]'::jsonb,
  total integer not null,
  processed integer not null default 0,
  error text,
  -- A worker holds the job until lease_until; a stale lease means the worker
  -- died and the next status poll resumes it.
  lease_until timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint split_import_job_device_len check (char_length(device_id) <= 100),
  constraint split_import_job_merchants_len check (char_length(merchants) <= 12000),
  constraint split_import_job_total check (total between 1 and 500)
);

-- One job in flight per user.
create unique index if not exists split_import_job_one_active
  on public.split_import_job (user_id)
  where status in ('queued', 'running');

create table if not exists public.split_import_item (
  job_id uuid not null references public.split_import_job (id) on delete cascade,
  entry_id text not null,
  description text not null,
  amount_cents bigint not null,
  entry_created_at text not null,
  -- Items sharing a description share a chunk, so each description is sent
  -- to the model once.
  chunk integer not null,
  done boolean not null default false,
  category_id integer,
  subcategory_id integer,
  new_category_key text,
  confidence text check (confidence is null or confidence in ('high', 'medium', 'low')),
  primary key (job_id, entry_id),
  constraint split_import_item_desc_len check (char_length(description) <= 200)
);

create index if not exists split_import_item_chunk_idx
  on public.split_import_item (job_id, chunk) where not done;

alter table public.split_import_job enable row level security;
alter table public.split_import_item enable row level security;

drop policy if exists "split_import_job_owner_select" on public.split_import_job;
create policy "split_import_job_owner_select" on public.split_import_job
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "split_import_item_owner_select" on public.split_import_item;
create policy "split_import_item_owner_select" on public.split_import_item
  for select to authenticated
  using (exists (
    select 1 from public.split_import_job j
    where j.id = job_id and j.user_id = auth.uid()
  ));

revoke insert, update, delete, truncate on public.split_import_job from anon, authenticated;
revoke insert, update, delete, truncate on public.split_import_item from anon, authenticated;
revoke all on public.split_import_job from anon;
revoke all on public.split_import_item from anon;

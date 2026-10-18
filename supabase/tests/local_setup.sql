-- Local test stack only: the pieces of the live project that the
-- public-schema dump (supabase/schema/public_baseline.sql) doesn't carry.

-- Signup trigger lives on auth.users, outside the dumped schema.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The dump creates balance_pair WITH NO DATA; the app's triggers refresh it
-- CONCURRENTLY, which needs it populated once.
refresh materialized view public.balance_pair;

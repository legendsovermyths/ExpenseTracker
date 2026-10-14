# Notifications — Supabase pieces

This project's Supabase schema has never been tracked in git before this —
these files are the first of it. Applying them to the live project is a
manual step (no CLI credentials/service-role key live in this repo,
intentionally) — as of this writing, `0001`–`0004` have all been applied,
the `service_role_key` Vault secret is seeded, `send-push` is deployed, and
`notifications`/`fund` are both in the Realtime publication. If you're
reading this after pulling a fresh `.sql` file added to `migrations/`,
that one (and only that one) is the one that still needs the steps below.

## What's here

- `migrations/0001_notifications.sql` — `notifications` + `push_tokens`
  tables, RLS policies, and the trigger that fans a new split (`line_item`
  insert) out to a notification row for the other participant.
- `functions/send-push/index.ts` — Edge Function that turns a new
  `notifications` row into an actual push via Expo's push API.

## One-time setup (do this once, in order)

1. **Apply the migration.** Either:
   - Paste `migrations/0001_notifications.sql` into the Supabase dashboard's
     SQL editor and run it, or
   - `supabase link --project-ref <your-project-ref>` then `supabase db push`
     (requires installing the Supabase CLI first: `brew install supabase/tap/supabase`).
2. **Enable Realtime on `notifications`.** Dashboard → Database → Replication
   → toggle the `notifications` table on. (`push_tokens` doesn't need this —
   nothing subscribes to it.)
3. **Deploy the Edge Function:**
   ```
   supabase functions deploy send-push
   supabase secrets set SERVICE_ROLE_KEY=<your project's service_role key>
   ```
   The service role key is in Dashboard → Project Settings → API — do **not**
   put it in `.env` or anywhere client-side.
4. **Wire the webhook.** Dashboard → Database → Webhooks → New webhook:
   - Table: `notifications`, Event: `Insert`
   - Type: Supabase Edge Function → select `send-push`
5. **Verify end-to-end:** insert a test row manually in the SQL editor —
   ```sql
   insert into notifications (user_id, type, actor_id, payload)
   values ('<your-auth-uid>', 'split_added', '<your-auth-uid>',
           '{"description": "test", "amount_cents": 100}');
   ```
   You should get a push within a few seconds (assuming a device has
   registered a token via the app first) and `push_sent_at` on that row
   should get stamped.

## Extending to a new feature (e.g. Kitty)

Only step 1 changes per feature — add a new trigger function (same shape as
`notify_split_participants`) on the new source table, insert into the same
`notifications` table with a new `type`. The Edge Function, RLS, and
Realtime channel are already shared; add a `case` branch in
`functions/send-push/index.ts`'s `titleAndBodyFor` for the new `type`.

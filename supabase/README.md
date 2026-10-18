# Notifications — Supabase pieces

This project's Supabase schema has never been tracked in git before this —
these files are the first of it. Applying them to the live project is a
manual step (no CLI credentials/service-role key live in this repo,
intentionally) — as of this writing, `0001`–`0009` have all been applied,
the `service_role_key` Vault secret is seeded, `send-push` is deployed, and
`notifications`/`fund` are both in the Realtime publication. If you're
reading this after pulling a fresh `.sql` file added to `migrations/`,
that one (and only that one) is the one that still needs the steps below.

## What's here

- `migrations/0001_notifications.sql` — `notifications` + `push_tokens`
  tables, RLS policies, and the trigger that fans a new split (`line_item`
  insert) out to a notification row for the other participant.
- `migrations/0008_groups.sql` — group splits: `grp`/`grp_member` RLS +
  sync columns, `balance_pair` rewritten so 3+-person entries split debts
  proportionally (debtor → creditor by each creditor's share of the credit),
  and `group_added` notifications.
- `migrations/0009_entry_visibility.sql` — fixes `ledger_entry`/`line_item`
  RLS (a shadowed parameter made every entry visible to every user); access
  is now creator, participant, or member of the entry's group.
- `migrations/0010_security_hardening.sql`: the access rules in
  `docs/SECURITY.md`. Splits are visible only to their people, profiles
  only to people you share something with, helpers are moved off `/rpc`,
  and ownership columns are pinned. Proven by `tests/run.sh`.
- `functions/ai/index.ts`: the only path to OpenAI. The key, model and
  prompts live here; it enforces auth, size limits and a per-user daily
  quota.
- `schema/public_baseline.sql`: a dump of production's `public` schema.
  The tables made in the dashboard were never in git; this is the record.
- `tests/`: an end-to-end RLS suite on a local Docker stack (see
  `docs/SECURITY.md`).
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

## Friend QR links (`functions/add-friend`)

Friend QR codes encode `https://<project>.supabase.co/functions/v1/add-friend?id=…&name=…`
so the stock camera / any QR scanner can open them. The function 302-redirects
to `expensifyfinance://add-friend?…`, which opens the app. Deploy it **without**
JWT verification (scanners can't send a token):

```sh
supabase functions deploy add-friend --no-verify-jwt --project-ref <project-ref>
```

## AI function (`functions/ai`)

```sh
supabase secrets set OPENAI_API_KEY=<key>      # optional: AI_DAILY_LIMIT=150
supabase functions deploy ai                   # JWT verification stays on
```

## Security follow-ups (`0011`, `send-push`, `send-mail`)

```sh
supabase db push                                   # applies 0011
supabase functions deploy send-push --no-verify-jwt
supabase functions deploy send-mail                # JWT verification stays on
```

## AI icons (`0012`, `functions/ai` task `generate_icon`)

Deploy in this order: the app's sync reads `grp.icon_*` and the `icon`
table, so the migration must be live before the new build ships.

```sh
supabase db push                 # applies 0012 (icon table, grp.icon_*, icon quota)
supabase functions deploy ai     # adds generate_icon; FLUX uses OPENAI_API_KEY
# optional: supabase secrets set ICON_DAILY_LIMIT=20
```

Tune the prompt (`functions/ai/icon_prompt.mjs`) against the real model:

```sh
node supabase/tests/icon-lab.mjs        # asks for the key, ~1 generation per subject
(cd sdk && ICON_LAB_DIR=/tmp/icon-lab cargo test icon_lab -- --ignored --nocapture)
open /tmp/icon-lab/sheet.html            # FLUX output next to the traced icon
```

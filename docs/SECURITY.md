# Security

The app ships with the Supabase URL and anon key, which is normal. Everything else rests on two rules:

1. **No secrets in the app.** The OpenAI key, model and prompts live in the `ai` Edge Function.
2. **Row-level security decides who sees what.** Policies are in `supabase/migrations/0010_security_hardening.sql`, and every rule below is proven by `supabase/tests/rls-e2e.mjs`.

## Who can see and change what

| Data | Can see | Can change / delete | Notes |
|------|---------|---------------------|-------|
| Split (`ledger_entry` + `line_item`) | Its creator, its participants, members of its group | Same people | Nobody else can tell it exists. |
| Adding a person to a split | The creator can add anyone | | Other participants edit existing people's lines. In a group split, anyone can add a group member. |
| Split creator / group | | Never changes | Pinned by a trigger, which silently keeps the old value so a stale client can't wedge sync. |
| Group (`grp`, `grp_member`) | Members (former members keep the group row so their removal syncs) | Any current member: rename, delete, add or remove members | |
| Group creator | | Never changes | Pinned by a trigger. |
| Fund + entries | Owner and other participant | Either party edits the fund; entries only by their contributor | Only the owner can change the other participant. The owner never changes. |
| Profile | Name only: yourself, plus anyone you share a split, group or fund with | | Email and phone are never readable over the API; the app reads your own from the auth session. No search: people are added by **QR only**, and `profile_name(id)` returns just the name for a scanned code. |
| Generated icon (`icon`) | Its owner, plus members (current or former) of a group and parties of a fund that uses it | Owner only, and only `is_deleted`: path and prompt are immutable | Stored as SVG path data only (CHECK: starts with a move, path characters only, ≤ 16 KB), never as an SVG document, so there is no markup to sanitize. A group or fund can only point at an icon the writer can already see; anything else is quietly dropped (keeps the previous icon) so an icon id can't be used to read someone's private icon. |
| Notifications, push tokens, `exports` storage | Owner only | Owner only | A device token belongs to one account at a time (`register_push_token`), and logout removes it. |
| Signed out | Nothing | Nothing | |

Policy helpers live in the `private` schema, so they can't be called over `/rpc`, and they read `auth.uid()` themselves. Trigger functions aren't callable either.

## AI

`supabase/functions/ai` is the only path to OpenAI:
- It requires a signed-in user.
- It takes typed tasks only (`parse_receipt`, `classify_document`, `generate_icon`), so the client can't send prompts or pick models.
- `generate_icon` takes only a short subject (60 characters, letters/numbers/basic punctuation). The house-style prompt in `functions/ai/icon_prompt.mjs` wraps it in quotes, so the user can't restyle or re-prompt the model. The image goes back to the app, which traces it on the device with the Rust SDK.
- Size caps: 4 MB for images, 8 MB for PDFs.
- It allows 150 text calls per user per day (`private.ai_usage`, `ai_consume_quota`) and 20 icon generations (`private.icon_usage`, `icon_consume_quota`; refunded via `icon_refund_quota` when FLUX itself fails, not when it refuses content). Only the service role can call the quota functions.

The app calls it through `invokeAI()` in `services/ImageParser.ts`. ESLint fails the build if an OpenAI URL, key or `process.env.OPEN_AI*` reaches app code.

## Edge Functions

| Function | Who may call it | Notes |
|----------|-----------------|-------|
| `ai` | Signed-in users | Typed tasks only, size caps, 150 text calls and 20 icons a day per user. FLUX (Azure) uses the same `OPENAI_API_KEY` secret. |
| `send-push` | Only the `notifications` trigger | Deployed with `--no-verify-jwt`. The bearer token must match Vault's `service_role_key` (`is_push_webhook_key`) or the platform service key. The push is built from the stored row, never the request body, and is sent at most once. |
| `send-mail` | Signed-in users | Always mails the caller's own verified email; a `to` field is ignored. PDF only, 8 MB cap, 5 emails a day per user. |
| `add-friend` | Anyone (QR scanners) | Validates the UUID and only redirects into the app's own scheme. |

## Testing the rules

```sh
supabase/tests/run.sh            # live schema + new migrations, on a local Docker stack
supabase/tests/run.sh baseline   # live schema only (shows production's current holes as OPEN)
supabase/tests/run.sh stop       # tear the stack down
```

The suite drives five users through the exact calls `services/BackgroundSync.ts` makes, then checks the real rows with the service role:
- Add, view, edit and delete for splits, three-way splits, payments, groups, group splits and funds.
- Profiles and notifications.
- Every attack an outsider can try.
- The `ai` function's refusals and its daily limits, including icon generation against a local FLUX stub (request shape, prompt wrapping, injection, content filter, outages and refunds).
- Who can see and attach generated icons.

Run it before any policy change ships. `supabase/schema/public_baseline.sql` is a dump of production's schema; refresh it with:

```sh
supabase db dump --linked --schema public -f supabase/schema/public_baseline.sql
```

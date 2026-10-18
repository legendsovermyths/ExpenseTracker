// Supabase Edge Function: fans a newly-inserted `notifications` row out to
// the recipient's registered device(s) via Expo's push API.
//
// Caller: the `trg_send_push` trigger on `notifications`, which POSTs here
// with the Vault `service_role_key` as its bearer token. Deployed with
// --no-verify-jwt, so the function authorises the caller itself: the bearer
// must match that Vault key (checked in the database by
// is_push_webhook_key) or the platform's own service key. Anyone else gets
// 401.
//
// The request body is untrusted. Only `record.id` is read from it; the
// recipient, type and text all come from the stored row, and a row that
// was already pushed is never pushed again.

import { createClient } from "npm:@supabase/supabase-js@2";

interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  actor_id: string;
  payload: Record<string, unknown>;
  created_at: string;
  push_sent_at: string | null;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const PLATFORM_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ADMIN_KEY = PLATFORM_SERVICE_KEY || Deno.env.get("SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, ADMIN_KEY, {
  auth: { persistSession: false },
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function sameString(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function isTrustedCaller(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const key = auth.slice("Bearer ".length).trim();
  if (!key) return false;
  if (sameString(key, PLATFORM_SERVICE_KEY)) return true;
  const { data, error } = await supabase.rpc("is_push_webhook_key", { p_key: key });
  return !error && data === true;
}

function formatRupees(cents: unknown): string {
  const n = typeof cents === "number" ? Math.abs(cents) / 100 : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function titleAndBodyFor(
  row: NotificationRow,
  actor: string | null,
): { title: string; body: string } {
  const amount = formatRupees(row.payload.amount_cents);
  const who = actor ?? "Someone";
  const cents = typeof row.payload.amount_cents === "number" ? row.payload.amount_cents : 0;
  switch (row.type) {
    case "split_added": {
      const desc = (row.payload.description as string) || "a shared expense";
      const share = cents < 0 ? `you owe ${amount}` : `you get ${amount}`;
      const group = row.payload.group_name as string | undefined;
      return {
        title: group ? `${who} added an expense in ${group}` : `${who} added a split`,
        body: `${desc} · ${share}`,
      };
    }
    case "group_added":
      return { title: "New group", body: `${who} added you to "${row.payload.group_name}"` };
    case "split_payment":
      return { title: `${who} recorded a payment`, body: `${amount} settled` };
    case "fund_contribution":
      return { title: (row.payload.fund_name as string) || "Fund", body: `${who} added ${amount}` };
    case "fund_withdrawal":
      return { title: (row.payload.fund_name as string) || "Fund", body: `${who} withdrew ${amount}` };
    case "fund_created":
      return { title: "New fund", body: `${who} added you to "${row.payload.fund_name}"` };
    default:
      return { title: "Expensify", body: "You have a new update." };
  }
}

async function resolveActorName(actorId: string | undefined): Promise<string | null> {
  if (!actorId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", actorId)
    .maybeSingle();
  const name = data?.full_name?.trim() || data?.email?.split("@")[0] || null;
  return name ? name.split(" ")[0] : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  try {
    if (!(await isTrustedCaller(req))) {
      console.warn("send-push: rejected untrusted caller");
      return json(401, { error: "Unauthorized" });
    }

    let id: unknown;
    try {
      id = (await req.json())?.record?.id;
    } catch {
      return json(400, { error: "Invalid JSON" });
    }
    if (typeof id !== "string" || !UUID_RE.test(id)) {
      return json(400, { error: "Missing notification id" });
    }

    const { data: record, error: rowErr } = await supabase
      .from("notifications")
      .select("id,user_id,type,actor_id,payload,created_at,push_sent_at")
      .eq("id", id)
      .maybeSingle<NotificationRow>();
    if (rowErr) throw rowErr;
    if (!record) return json(404, { error: "Notification not found" });
    if (record.push_sent_at) return json(200, { skipped: "already sent" });

    const { data: tokens, error: tokenErr } = await supabase
      .from("push_tokens")
      .select("token")
      .eq("user_id", record.user_id);

    if (tokenErr) throw tokenErr;
    if (!tokens || tokens.length === 0) {
      return json(200, { skipped: "no push tokens" });
    }

    const actor = await resolveActorName(record.actor_id);
    const { title, body } = titleAndBodyFor(record, actor);

    const messages = tokens.map((t) => ({
      to: t.token,
      title,
      body,
      data: { type: record.type, payload: record.payload, notificationId: record.id },
    }));

    const pushRes = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!pushRes.ok) {
      throw new Error(`Expo push API responded ${pushRes.status}`);
    }

    await supabase
      .from("notifications")
      .update({ push_sent_at: new Date().toISOString() })
      .eq("id", record.id);

    return json(200, { sent: messages.length });
  } catch (err) {
    console.error(err);
    return json(500, { error: "Push failed" });
  }
});

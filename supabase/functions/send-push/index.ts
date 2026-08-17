// Supabase Edge Function — fans a newly-inserted `notifications` row out to
// the recipient's registered device(s) via Expo's push API.
//
// Trigger: a Database Webhook on `notifications` (AFTER INSERT), configured
// in the Supabase dashboard to POST here. Not wired up automatically by this
// repo — see supabase/README.md.
//
// Required secret (set via `supabase secrets set SERVICE_ROLE_KEY=...`):
//   SERVICE_ROLE_KEY — needed to read push_tokens (RLS-restricted to the
//   owning user) and to stamp `push_sent_at` back onto the notification row.
//   Never expose this key to the client.

import { createClient } from "npm:@supabase/supabase-js@2";

interface WebhookPayload {
  type: "INSERT";
  table: string;
  record: {
    id: string;
    user_id: string;
    type: string;
    actor_id: string;
    payload: Record<string, unknown>;
    created_at: string;
  };
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

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
  row: WebhookPayload["record"],
  actor: string | null,
): { title: string; body: string } {
  const amount = formatRupees(row.payload.amount_cents);
  const who = actor ?? "Someone";
  const cents = typeof row.payload.amount_cents === "number" ? row.payload.amount_cents : 0;
  switch (row.type) {
    case "split_added": {
      const desc = (row.payload.description as string) || "a shared expense";
      const share = cents < 0 ? `you owe ${amount}` : `you get ${amount}`;
      return { title: `${who} added a split`, body: `${desc} · ${share}` };
    }
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
  try {
    const { record } = (await req.json()) as WebhookPayload;

    const { data: tokens, error: tokenErr } = await supabase
      .from("push_tokens")
      .select("token")
      .eq("user_id", record.user_id);

    if (tokenErr) throw tokenErr;
    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ skipped: "no push tokens" }), { status: 200 });
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

    return new Response(JSON.stringify({ sent: messages.length }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});

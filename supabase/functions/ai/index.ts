// Supabase Edge Function: the app's only path to the LLM.
//
// The OpenAI key, model and prompts live here, never in the app bundle. The
// client sends a task name plus the data that task needs; this function
// checks the caller's session, enforces size limits and a per-user daily
// quota, builds the prompt and returns the model's raw output text.
//
// Secrets (`supabase secrets set …`):
//   OPENAI_API_KEY   required
//   AI_DAILY_LIMIT   optional, calls per user per day (default 150)
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// by the platform.
//
// Deploy with JWT verification on (the default):
//   supabase functions deploy ai

import { createClient } from "npm:@supabase/supabase-js@2";

const OPENAI_URL = "https://api.openai.com/v1/responses";
const MODEL = "gpt-5.6-luna";
const MAX_IMAGE_B64 = 4 * 1024 * 1024;
const MAX_PDF_B64 = 8 * 1024 * 1024;
const MAX_CONTEXT_CHARS = 12_000;
const TIMEOUT_MS = 60_000;

const DAILY_LIMIT = Number(Deno.env.get("AI_DAILY_LIMIT") ?? "150");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const str = (v: unknown, max: number, field: string): string => {
  if (typeof v !== "string") throw new HttpError(400, `${field} must be a string`);
  if (v.length > max) throw new HttpError(413, `${field} is too large`);
  return v;
};

const B64_RE = /^[A-Za-z0-9+/=\r\n]+$/;
const b64 = (v: unknown, max: number, field: string): string => {
  const s = str(v, max, field);
  if (!s || !B64_RE.test(s)) throw new HttpError(400, `${field} must be base64`);
  return s;
};

type Receipt = {
  image_b64: string;
  today: string;
  merchants: string;
  categories: string;
  accounts: string;
};

function receiptPrompt(r: Receipt): string {
  return `You are a financial transaction parser for an expense tracking app. Today's date is ${r.today}.

User's recent merchant history (last 3 months):
${r.merchants || "No history yet"}

Available categories (format: id:name [subcategory_id:subcategory_name, ...]):
${r.categories}

Available bank/payment accounts (format: id:name):
${r.accounts}

Look at this image. If it contains one or more financial transactions (receipt, bill, bank SMS, UPI confirmation, payment app screenshot, transaction history), extract ALL visible transactions.

Return ONLY valid JSON in this exact format:
{
  "found": true,
  "transactions": [
    {
      "description": "merchant or purpose",
      "amount": 450.00,
      "is_credit": false,
      "date": "2025-05-20",
      "category_id": 3,
      "subcategory_id": 7,
      "account_id": 2
    }
  ]
}

If the image does not contain any transaction, return: {"found": false}

Rules:
- A single bill or receipt is ONE transaction, amount is the total paid
- If there are multiple separate transactions, return each as a separate transaction
- Extract ALL visible transactions. If it is a history/statement screenshot, list every separate transaction shown
- date: use "YYYY-MM-DD" format. Infer year from context (assume current year if only day/month shown). Omit the field entirely if date is not visible
- amount is a plain number, no currency symbols
- is_credit is true for incoming money (salary, refund, received), false for expenses/payments
- Use category_id and subcategory_id exactly from the available categories list
- Use account_id from the available accounts. Infer the bank/payment app aggressively using every available signal: explicit bank name or logo in the image, app UI style (Paytm's blue, PhonePe's purple, GPay's white/colourful, CRED's black), sender/receiver labels (e.g. "From: HDFC Bank"), UPI handle suffixes (e.g. @hdfcbank, @ybl for PhonePe, @oksbi for SBI, @okhdfcbank, @okaxis), account number hints, or watermarks. Never leave account_id empty, always pick the closest match from the available accounts
- Prefer matching description to merchant history for consistent categorisation
- description must be in Title Case (first letter of each word capitalised, rest lowercase) e.g. "Swiggy Food Order", "Amazon Purchase"
- Order transactions chronologically, newest first`;
}

const CLASSIFY_PROMPT = `You are looking at a document a user attached to an expense.
Classify it as exactly one of:
- BILL: a utility/service/restaurant bill or statement asking for payment
- INVOICE: an itemised invoice from a seller or business (often with a tax/GST number)
- RECEIPT: proof of a completed payment (shop receipt, card slip, UPI/payment confirmation)
- WARRANTY: a warranty card, guarantee certificate or product registration
- OTHER: anything else

Return ONLY JSON: {"doc_type": "BILL" | "INVOICE" | "RECEIPT" | "WARRANTY" | "OTHER"}`;

// deno-lint-ignore no-explicit-any
function buildOpenAiBody(req: any) {
  if (req?.task === "parse_receipt") {
    const r: Receipt = {
      image_b64: b64(req.image_b64, MAX_IMAGE_B64, "image_b64"),
      today: /^\d{4}-\d{2}-\d{2}$/.test(String(req.today))
        ? req.today
        : new Date().toISOString().slice(0, 10),
      merchants: str(req.merchants ?? "", MAX_CONTEXT_CHARS, "merchants"),
      categories: str(req.categories ?? "", MAX_CONTEXT_CHARS, "categories"),
      accounts: str(req.accounts ?? "", MAX_CONTEXT_CHARS, "accounts"),
    };
    return {
      model: MODEL,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: receiptPrompt(r) },
          { type: "input_image", image_url: `data:image/jpeg;base64,${r.image_b64}` },
        ],
      }],
      text: { format: { type: "json_object" } },
      reasoning: { effort: "medium" },
    };
  }

  if (req?.task === "classify_document") {
    const mime = str(req.mime_type, 100, "mime_type");
    let content: unknown;
    if (/^image\/(jpeg|jpg|png|heic|heif|webp|gif)$/.test(mime)) {
      const data = b64(req.data_b64, MAX_IMAGE_B64, "data_b64");
      content = { type: "input_image", image_url: `data:${mime};base64,${data}` };
    } else if (mime === "application/pdf") {
      const data = b64(req.data_b64, MAX_PDF_B64, "data_b64");
      const name = str(req.file_name ?? "document.pdf", 200, "file_name");
      content = {
        type: "input_file",
        filename: name,
        file_data: `data:application/pdf;base64,${data}`,
      };
    } else {
      throw new HttpError(400, "Unsupported document type");
    }
    return {
      model: MODEL,
      input: [{
        role: "user",
        content: [{ type: "input_text", text: CLASSIFY_PROMPT }, content],
      }],
      text: { format: { type: "json_object" } },
    };
  }

  throw new HttpError(400, "Unknown task");
}

// deno-lint-ignore no-explicit-any
function outputText(data: any): string | null {
  const output = data?.output;
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    if (item?.type !== "message" || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part?.type === "output_text" && typeof part.text === "string") return part.text;
    }
  }
  return null;
}

async function callerId(req: Request): Promise<string> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) throw new HttpError(401, "Not signed in");
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Not signed in");
  return data.user.id;
}

async function consumeQuota(uid: string) {
  const { data, error } = await admin.rpc("ai_consume_quota", {
    p_user: uid,
    p_limit: DAILY_LIMIT,
  });
  if (error) throw new HttpError(500, "Quota check failed");
  if (data !== true) throw new HttpError(429, "Daily AI limit reached");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  try {
    if (!OPENAI_API_KEY) throw new HttpError(500, "AI is not configured");
    const uid = await callerId(req);

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      throw new HttpError(400, "Invalid JSON");
    }
    const body = buildOpenAiBody(payload);
    await consumeQuota(uid);

    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ ...body, user: uid }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error("OpenAI error", res.status, (await res.text()).slice(0, 500));
      throw new HttpError(502, "AI request failed");
    }
    return json(200, { text: outputText(await res.json()) });
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message });
    console.error(e);
    return json(500, { error: "Unexpected error" });
  }
});

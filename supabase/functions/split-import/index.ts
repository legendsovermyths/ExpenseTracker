// Supabase Edge Function: background AI categorisation for "Import splits".
//
// The app sends its unlinked splits and can be closed straight away; this
// function categorises them in the background, chunk by chunk, saving each
// chunk as it finishes. When the job is done it inserts a `notifications`
// row, which the existing trigger turns into a push via `send-push`. The app
// applies the results to its local database on next open and acks the job,
// which deletes it.
//
// POST { action: "start", device_id, account_id, categories, merchants, items }
//        → { job_id }
// POST { action: "status", job_id } → { job, items? }   (items once finished)
// POST { action: "ack" | "cancel", job_id } → { ok: true }   (deletes the job)
//
// A worker holds a job via `lease_until`. If it dies (wall-clock limit,
// crash), the next `status` call finds the stale lease and resumes the
// remaining chunks, so a job never needs more than the app polling it.
//
// Secrets: OPENAI_API_KEY (shared with the `ai` function), optional
// OPENAI_URL and AI_DAILY_LIMIT. Each chunk costs one unit of the `ai`
// function's daily quota.
//
// Deploy with JWT verification on (the default):
//   supabase functions deploy split-import

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  assignChunks,
  buildPrompt,
  distinctDescriptions,
  parseChunkResult,
} from "./categorize.mjs";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const OPENAI_URL = Deno.env.get("OPENAI_URL") ??
  "https://expensify-resource.openai.azure.com/openai/v1/responses";
const MODEL = "gpt-5.6-luna";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const DAILY_LIMIT = Number(Deno.env.get("AI_DAILY_LIMIT") ?? "150");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_ITEMS = 500;
const MAX_CATEGORIES = 400;
const MAX_MERCHANTS_CHARS = 12_000;
const MODEL_TIMEOUT_MS = 60_000;
const LEASE_MS = 3 * 60_000;
const MAX_ATTEMPTS = 6;
const CONCURRENCY = 3;
const QUOTA_ERROR = "Daily AI limit reached";
const ABANDONED_DONE_MS = 7 * 24 * 60 * 60_000;
const ABANDONED_ACTIVE_MS = 30 * 60_000;

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

type Cat = { id: number; name: string; parent_id: number | null };
type NewCat = { key: string; name: string; parent_id: number | null };
type ItemRow = {
  job_id: string;
  entry_id: string;
  description: string;
  amount_cents: number;
  entry_created_at: string;
  chunk: number;
  done: boolean;
  category_id: number | null;
  subcategory_id: number | null;
  new_category_key: string | null;
  confidence: string | null;
};

const UUID_RE = /^[0-9a-f-]{36}$/i;
const isInt = (v: unknown): v is number => Number.isInteger(v);
const posInt = (v: unknown): v is number => isInt(v) && (v as number) > 0;

function str(v: unknown, max: number, field: string): string {
  if (typeof v !== "string" || !v) throw new HttpError(400, `${field} must be a non-empty string`);
  if (v.length > max) throw new HttpError(413, `${field} is too large`);
  return v;
}

function jobId(v: unknown): string {
  if (typeof v !== "string" || !UUID_RE.test(v)) throw new HttpError(400, "job_id is invalid");
  return v;
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

// ── start ────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
function parseCategories(raw: any): Cat[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_CATEGORIES) {
    throw new HttpError(400, "categories must be a non-empty list");
  }
  return raw.map((c) => {
    if (!posInt(c?.id)) throw new HttpError(400, "category id is invalid");
    return {
      id: c.id,
      name: str(c.name, 60, "category name"),
      parent_id: posInt(c.parent_id) ? c.parent_id : null,
    };
  });
}

// deno-lint-ignore no-explicit-any
async function start(uid: string, body: any): Promise<Response> {
  const deviceId = str(body.device_id, 100, "device_id");
  if (!posInt(body.account_id)) throw new HttpError(400, "account_id is invalid");
  const categories = parseCategories(body.categories);
  const merchants = typeof body.merchants === "string"
    ? body.merchants.slice(0, MAX_MERCHANTS_CHARS)
    : "";
  const catIds = new Set(categories.map((c) => c.id));

  const rawItems = body.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new HttpError(400, "items must be a non-empty list");
  }
  if (rawItems.length > MAX_ITEMS) throw new HttpError(413, `At most ${MAX_ITEMS} splits per import`);

  const seen = new Set<string>();
  const prefilled: Omit<ItemRow, "job_id">[] = [];
  const pending: { entry_id: string; description: string; amount_cents: number; entry_created_at: string }[] = [];
  for (const it of rawItems) {
    const entryId = str(it?.entry_id, 64, "entry_id");
    if (seen.has(entryId)) continue;
    seen.add(entryId);
    if (!posInt(it.amount_cents)) throw new HttpError(400, "amount_cents is invalid");
    const base = {
      entry_id: entryId,
      description: str(it.description, 200, "description"),
      amount_cents: it.amount_cents,
      entry_created_at: str(it.created_at, 40, "created_at"),
    };
    // The device already categorised it from merchant history.
    if (posInt(it.category_id) && catIds.has(it.category_id)) {
      prefilled.push({
        ...base,
        chunk: -1,
        done: true,
        category_id: it.category_id,
        subcategory_id: posInt(it.subcategory_id) && catIds.has(it.subcategory_id)
          ? it.subcategory_id
          : null,
        new_category_key: null,
        confidence: "high",
      });
    } else {
      pending.push(base);
    }
  }

  // Housekeeping: drop this user's jobs nobody will come back for — finished
  // but never acked within a week, or in flight with no progress or poll for
  // 30 minutes (its worker died and its device lost track of it).
  const now = Date.now();
  await admin.from("split_import_job").delete().eq("user_id", uid)
    .in("status", ["done", "failed"]).lt("updated_at", new Date(now - ABANDONED_DONE_MS).toISOString());
  await admin.from("split_import_job").delete().eq("user_id", uid)
    .in("status", ["queued", "running"]).lt("updated_at", new Date(now - ABANDONED_ACTIVE_MS).toISOString())
    .or(`lease_until.is.null,lease_until.lt.${new Date(now).toISOString()}`);

  const allDone = pending.length === 0;
  const { data: job, error: jobErr } = await admin
    .from("split_import_job")
    .insert({
      user_id: uid,
      device_id: deviceId,
      account_id: body.account_id,
      categories,
      merchants,
      total: prefilled.length + pending.length,
      processed: prefilled.length,
      status: allDone ? "done" : "queued",
    })
    .select("id")
    .single();
  if (jobErr) {
    if (jobErr.code === "23505") {
      // Hand back the running job so its device can pick it up again.
      const { data: active } = await admin
        .from("split_import_job")
        .select("id,device_id,account_id,total")
        .eq("user_id", uid)
        .in("status", ["queued", "running"])
        .maybeSingle();
      return json(409, {
        error: "An import is already running",
        job_id: active?.id ?? null,
        device_id: active?.device_id ?? null,
        account_id: active?.account_id ?? null,
        total: active?.total ?? null,
      });
    }
    console.error("job insert failed", jobErr.message);
    throw new HttpError(500, "Couldn't start the import");
  }

  const rows: ItemRow[] = [
    ...prefilled.map((p) => ({ ...p, job_id: job.id })),
    ...assignChunks(pending).map((p) => ({
      ...p,
      job_id: job.id,
      done: false,
      category_id: null,
      subcategory_id: null,
      new_category_key: null,
      confidence: null,
    })),
  ];
  const { error: itemErr } = await admin.from("split_import_item").insert(rows);
  if (itemErr) {
    console.error("item insert failed", itemErr.message);
    await admin.from("split_import_job").delete().eq("id", job.id);
    throw new HttpError(500, "Couldn't start the import");
  }

  if (!allDone) EdgeRuntime.waitUntil(processJob(job.id));
  return json(200, { job_id: job.id });
}

// ── processing ───────────────────────────────────────────────────────────

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

async function callModel(uid: string, prompt: string): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": OPENAI_API_KEY },
        body: JSON.stringify({
          model: MODEL,
          input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
          text: { format: { type: "json_object" } },
          reasoning: { effort: "low" },
          user: uid,
        }),
        signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
      });
      if (res.ok) return outputText(await res.json());
      console.error("OpenAI error", res.status, (await res.text()).slice(0, 500));
    } catch (e) {
      console.error("OpenAI unreachable", e);
    }
  }
  return null;
}

async function notifyDone(uid: string, id: string, count: number, total: number, failed: boolean) {
  const { error } = await admin.from("notifications").insert({
    user_id: uid,
    type: "split_import_done",
    actor_id: uid,
    payload: { job_id: id, count, total, failed },
  });
  if (error) console.error("notification insert failed", error.message);
}

async function processJob(id: string): Promise<void> {
  const { data: job, error } = await admin
    .from("split_import_job")
    .select("id,user_id,status,categories,merchants,new_categories,total,processed,lease_until,attempts")
    .eq("id", id)
    .maybeSingle();
  if (error || !job) return;
  if (job.status === "done" || job.status === "failed") return;
  if (job.lease_until && new Date(job.lease_until).getTime() > Date.now()) return;
  if (job.attempts >= MAX_ATTEMPTS) {
    await admin
      .from("split_import_job")
      .update({ status: "failed", error: "The import kept failing", lease_until: null, updated_at: new Date().toISOString() })
      .eq("id", id);
    await notifyDone(job.user_id, id, job.processed, job.total, true);
    return;
  }

  // Claim the job. The attempts check makes the claim atomic: if another
  // worker claimed it first, this update matches nothing.
  const lease = () => new Date(Date.now() + LEASE_MS).toISOString();
  const { data: claimed } = await admin
    .from("split_import_job")
    .update({ status: "running", lease_until: lease(), attempts: job.attempts + 1, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("attempts", job.attempts)
    .select("id");
  if (!claimed?.length) return;

  const uid: string = job.user_id;
  const categories: Cat[] = job.categories;
  const proposed: NewCat[] = Array.isArray(job.new_categories) ? job.new_categories : [];
  let processed: number = job.processed;

  const { data: items, error: itemsErr } = await admin
    .from("split_import_item")
    .select("*")
    .eq("job_id", id)
    .eq("done", false);
  if (itemsErr) {
    await admin.from("split_import_job").update({ lease_until: null }).eq("id", id);
    return;
  }
  const chunks = new Map<number, ItemRow[]>();
  for (const it of (items ?? []) as ItemRow[]) {
    const list = chunks.get(it.chunk) ?? [];
    list.push(it);
    chunks.set(it.chunk, list);
  }

  const state: { stop: "quota" | "cancelled" | "crashed" | null } = { stop: null };

  const runChunk = async (rows: ItemRow[]) => {
    const { data: ok, error: qErr } = await admin.rpc("ai_consume_quota", {
      p_user: uid,
      p_limit: DAILY_LIMIT,
    });
    if (qErr) throw qErr;
    if (ok !== true) {
      state.stop = "quota";
      return;
    }
    const { descriptions, itemIndex } = distinctDescriptions(rows);
    const text = await callModel(uid, buildPrompt(categories, job.merchants, descriptions, proposed));
    // Synchronous from here to the next await, so `proposed` can't interleave
    // with another chunk's merge.
    const results = parseChunkResult(text, descriptions.length, categories, proposed);
    const updated = rows.map((r, i) => ({ ...r, done: true, ...results[itemIndex[i]] }));

    const { error: upErr } = await admin
      .from("split_import_item")
      .upsert(updated, { onConflict: "job_id,entry_id" });
    if (upErr) {
      if (upErr.code === "23503") {
        state.stop = "cancelled"; // job deleted (cancelled) mid-run
        return;
      }
      throw upErr;
    }
    processed += updated.length;
    const { data: still } = await admin
      .from("split_import_job")
      .update({
        processed,
        new_categories: proposed,
        lease_until: lease(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id");
    if (!still?.length) state.stop = "cancelled";
  };

  const queue = [...chunks.keys()].sort((a, b) => a - b).map((k) => chunks.get(k)!);
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length && !state.stop) {
        try {
          await runChunk(queue.shift()!);
        } catch (e) {
          console.error("chunk failed", e);
          state.stop = "crashed";
        }
      }
    }),
  );

  if (state.stop === "cancelled") return;
  if (state.stop === "crashed") {
    // Release the lease so the next status poll retries the remaining chunks.
    await admin.from("split_import_job").update({ lease_until: null }).eq("id", id);
    return;
  }
  const failed = state.stop === "quota";
  await admin
    .from("split_import_job")
    .update({
      status: failed ? "failed" : "done",
      error: failed ? QUOTA_ERROR : null,
      lease_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  await notifyDone(uid, id, processed, job.total, failed);
}

// ── status / ack ─────────────────────────────────────────────────────────

async function status(uid: string, id: string): Promise<Response> {
  const { data: job, error } = await admin
    .from("split_import_job")
    .select("id,device_id,status,account_id,new_categories,total,processed,error,lease_until,created_at")
    .eq("id", id)
    .eq("user_id", uid)
    .maybeSingle();
  if (error) throw new HttpError(500, "Couldn't read the import");
  if (!job) throw new HttpError(404, "Import not found");

  const stale = !job.lease_until || new Date(job.lease_until).getTime() < Date.now();
  if ((job.status === "queued" || job.status === "running") && stale) {
    EdgeRuntime.waitUntil(processJob(id));
  }

  const { lease_until: _lease, ...pub } = job;
  if (job.status !== "done" && job.status !== "failed") return json(200, { job: pub });

  const { data: items, error: itemsErr } = await admin
    .from("split_import_item")
    .select("entry_id,description,amount_cents,entry_created_at,done,category_id,subcategory_id,new_category_key,confidence")
    .eq("job_id", id);
  if (itemsErr) throw new HttpError(500, "Couldn't read the import");
  return json(200, { job: pub, items });
}

async function remove(uid: string, id: string): Promise<Response> {
  const { error } = await admin.from("split_import_job").delete().eq("id", id).eq("user_id", uid);
  if (error) throw new HttpError(500, "Couldn't clear the import");
  return json(200, { ok: true });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  try {
    if (!OPENAI_API_KEY) throw new HttpError(500, "AI is not configured");
    const uid = await callerId(req);
    // deno-lint-ignore no-explicit-any
    let body: any;
    try {
      body = await req.json();
    } catch {
      throw new HttpError(400, "Invalid JSON");
    }
    switch (body?.action) {
      case "start":
        return await start(uid, body);
      case "status":
        return await status(uid, jobId(body.job_id));
      case "ack":
      case "cancel":
        return await remove(uid, jobId(body.job_id));
      default:
        throw new HttpError(400, "Unknown action");
    }
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message });
    console.error(e);
    return json(500, { error: "Unexpected error" });
  }
});

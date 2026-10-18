import uuid from "react-native-uuid";
import { invokeBackend } from "./api";
import { supabase } from "./Supabase";
import { AiError } from "./ImageParser";
import { Action } from "../types/actions/actions";
import { CUSTOM_ICON_TYPE, IconRow } from "../types/entity/Icon";
import { useExpensifyStore } from "../store/store";

export const MAX_ICON_PROMPT = 60;

// ── local store (Rust SDK) ──────────────────────────────────────────────────

export async function fetchIcons(): Promise<IconRow[]> {
  const res = await invokeBackend(Action.FetchIcons, {});
  return res.additions?.icons ?? [];
}

/** Load every local icon into the store so GlyphPlate can draw them. */
export async function refreshCustomIcons(): Promise<void> {
  useExpensifyStore.getState().setCustomIcons(await fetchIcons());
}

export async function deleteIcon(id: string): Promise<void> {
  await invokeBackend(Action.DeleteIcon, { id });
  const icon = useExpensifyStore.getState().customIcons[id];
  if (icon)
    useExpensifyStore
      .getState()
      .mergeCustomIcons([{ ...icon, is_deleted: true }]);
  pushIcons().catch((e) =>
    console.warn("[icons] push failed:", e?.message ?? e),
  );
}

/** The user's own, non-deleted icons, newest first: the picker's "Yours" row. */
export function myIcons(all: Record<string, IconRow>, me: string): IconRow[] {
  return Object.values(all)
    .filter((i) => i.owner_id === me && !i.is_deleted)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// ── generation ──────────────────────────────────────────────────────────────

export type IconDraft = { path: string; prompt: string };

/** Turn a FLUX image into a 24×24 path with the Rust SDK. */
export async function vectorizeIcon(imageB64: string): Promise<string> {
  const res = await invokeBackend(Action.VectorizeIcon, {
    image_b64: imageB64,
  });
  if (!res.data)
    throw new AiError("Couldn't make an icon from that. Try again");
  return res.data;
}

/**
 * Prompt → FLUX (server-side, house style applied there) → Rust tracer.
 * Throws AiError with a user-facing message; status 429 = daily limit.
 */
export async function generateIcon(prompt: string): Promise<IconDraft> {
  const subject = prompt.trim();
  if (!subject) throw new AiError("Describe the icon in a few words", 400);
  if (subject.length > MAX_ICON_PROMPT)
    throw new AiError("Keep it under 60 characters", 413);

  const { data, error } = await supabase.functions.invoke("ai", {
    body: { task: "generate_icon", prompt: subject },
  });
  if (error) {
    const res: Response | undefined = (error as any).context;
    let message = "Couldn't create an icon right now. Try again";
    try {
      const body = await res?.json();
      if (typeof body?.error === "string") message = body.error;
    } catch {
      /* non-JSON error body (offline, gateway) */
    }
    if (res?.status === 429)
      message = "You've made today's icons. More tomorrow";
    if (res?.status === 401) message = "Sign in to create icons";
    throw new AiError(message, res?.status);
  }
  if (typeof data?.image_b64 !== "string") {
    throw new AiError("Couldn't create an icon right now. Try again", 502);
  }
  try {
    return { path: await vectorizeIcon(data.image_b64), prompt: subject };
  } catch (e: any) {
    throw new AiError(
      e?.message || "Couldn't make an icon from that. Try again",
      422,
    );
  }
}

/** Keep a draft: saved locally (drawn immediately) and pushed in the background. */
export async function saveIcon(
  draft: IconDraft,
): Promise<{ name: string; type: string }> {
  const me = useExpensifyStore.getState().getUserId();
  const now = new Date().toISOString();
  const row: IconRow = {
    id: String(uuid.v4()),
    owner_id: me,
    path: draft.path,
    prompt: draft.prompt.slice(0, MAX_ICON_PROMPT),
    created_at: now,
    updated_at: now,
    is_deleted: false,
  };
  const res = await invokeBackend(Action.SaveIcon, { icon: row });
  const saved = res.additions?.icons?.[0] ?? row;
  useExpensifyStore.getState().mergeCustomIcons([saved]);
  pushIcons().catch((e) =>
    console.warn("[icons] push failed:", e?.message ?? e),
  );
  return { name: saved.id, type: CUSTOM_ICON_TYPE };
}

// The version that was pushed: the SDK only clears the dirty flag if the
// row is still at this version.
const ack = (i: IconRow) => ({ id: i.id, updated_at: i.updated_at ?? null });

// ── sync ────────────────────────────────────────────────────────────────────
//
// Push runs before groups/funds are pushed (they may point at a new icon,
// and Supabase drops references to icons it can't see). Pull asks for ids
// and timestamps first and only downloads paths that are new or changed.

let pushing: Promise<void> | null = null;
let pushAgain = false;

/**
 * Push dirty icons. A call made while a push is running (say, a delete
 * right after a save) runs one more pass afterwards, so it isn't lost.
 */
export function pushIcons(): Promise<void> {
  if (pushing) {
    pushAgain = true;
    return pushing;
  }
  pushing = (async () => {
    try {
      do {
        pushAgain = false;
        await pushOnce();
      } while (pushAgain);
    } finally {
      pushing = null;
    }
  })();
  return pushing;
}

async function pushOnce(): Promise<void> {
  const res = await invokeBackend(Action.GetDirtyIcons, {});
  const dirty = res.updates?.icons ?? [];
  if (dirty.length === 0) return;
  const rows = dirty.map((i) => ({
    id: i.id,
    owner_id: i.owner_id,
    path: i.path,
    prompt: i.prompt ?? null,
    created_at: i.created_at,
    is_deleted: i.is_deleted,
  }));
  const { error } = await supabase
    .from("icon")
    .upsert(rows, { onConflict: "id" });
  if (!error) {
    await invokeBackend(Action.SyncIcons, { pushed: dirty.map(ack) });
    return;
  }
  // One bad row must not wedge every future sync (and the group/fund
  // pushes queued behind it). Retry one by one; rows the server rejects
  // for good (constraint 23xxx, RLS 42501) stay local-only.
  const settled: string[] = [];
  let transient: unknown = null;
  for (const r of rows) {
    const { error: e } = await supabase
      .from("icon")
      .upsert([r], { onConflict: "id" });
    if (!e) settled.push(r.id);
    else if (e.code?.startsWith("23") || e.code === "42501") {
      console.warn(
        "[icons] server rejected icon, keeping it local:",
        r.id,
        e.message,
      );
      settled.push(r.id);
    } else transient = e;
  }
  if (settled.length) {
    await invokeBackend(Action.SyncIcons, {
      pushed: dirty.filter((i) => settled.includes(i.id)).map(ack),
    });
  }
  if (transient) throw transient;
}

let pulling: Promise<void> | null = null;

export function pullIcons(): Promise<void> {
  if (pulling) return pulling;
  pulling = (async () => {
    try {
      const { data: heads, error } = await supabase
        .from("icon")
        .select("id,updated_at");
      if (error) throw error;
      const local = useExpensifyStore.getState().customIcons;
      const want = (heads ?? [])
        .filter(
          (h: any) => !local[h.id] || local[h.id].updated_at !== h.updated_at,
        )
        .map((h: any) => h.id as string);
      for (let i = 0; i < want.length; i += 100) {
        const { data, error: e2 } = await supabase
          .from("icon")
          .select("id,owner_id,path,prompt,created_at,updated_at,is_deleted")
          .in("id", want.slice(i, i + 100));
        if (e2) throw e2;
        await invokeBackend(Action.SyncIcons, {
          icons: (data ?? []) as IconRow[],
        });
      }
      if (want.length > 0) await refreshCustomIcons();
    } finally {
      pulling = null;
    }
  })();
  return pulling;
}

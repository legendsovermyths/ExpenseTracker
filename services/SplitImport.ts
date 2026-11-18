// "Import splits": turns unlinked splits into transactions with AI-picked
// categories, in the background.
//
//  1. startSplitImport() sends the splits to the `split-import` Edge Function
//     and remembers the job id locally (app constant). The app can be closed.
//  2. The server categorises them and pushes a notification when done.
//  3. resumePendingImport() — on launch, on foreground and on that
//     notification — applies a finished job to the local database in one
//     SQLite transaction, then acks it (the server deletes it).
//
// Applying is idempotent (keyed by job id), so a crash between apply and ack
// just re-applies as a no-op next time.
//
// New categories are created by name with a placeholder icon, then queued
// for an AI icon (generatePendingCategoryIcons). The queue is persisted, so
// icons the daily icon limit or a closed app interrupted are made later.

import uuid from "react-native-uuid";
import { supabase } from "./Supabase";
import { invokeBackend } from "./api";
import { addAppconstant, updateAppconstant } from "./Appconstants";
import { AiError, buildMerchantMap } from "./ImageParser";
import { editCategory } from "./CategoryService";
import { generateIcon, MAX_ICON_PROMPT, saveIcon } from "./Icons";
import { useExpensifyStore } from "../store/store";
import { toast } from "../components/ui";
import { Action } from "../types/actions/actions";
import {
  ApplySplitImportResult,
  ImportBatchItem,
  ImportBatchSummary,
  UnlinkedSplit,
} from "../types/entity/SplitImport";
import {
  buildApplyPayload,
  buildStartItems,
  categoryRefs,
  fallbackCategoryId,
  historyMatches,
  JobItem,
  JobNewCategory,
  NEW_CATEGORY_ICON_TYPE,
  PLACEHOLDER_CATEGORY_ICON,
} from "./splitImportLogic";

export const MAX_IMPORT_SPLITS = 500;
export const DEFAULT_ACCOUNT_KEY = "defaultAccountId";
const PENDING_KEY = "pendingSplitImportJob";
const DEVICE_KEY = "deviceId";
const ICON_QUEUE_KEY = "pendingCategoryIcons";

export class SplitImportError extends Error {
  constructor(message: string, public status?: number, public body?: any) {
    super(message);
  }
}

export interface PendingImport {
  job_id: string;
  account_id: number;
  total: number;
  started_at: string;
}

export type ImportStatus =
  | { state: "idle" }
  | { state: "running"; pending: PendingImport; processed: number; total: number }
  | {
      state: "applied";
      batchId: string;
      result: ApplySplitImportResult;
      /** The job stopped before finishing (e.g. daily AI limit); the rest stay unlinked. */
      stoppedEarly: string | null;
    }
  | { state: "error"; pending: PendingImport | null; message: string };

async function call<T = any>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("split-import", { body });
  if (error) {
    const res: Response | undefined = (error as any).context;
    let message = error.message;
    let body: any;
    try {
      body = await res?.json();
      if (body?.error) message = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new SplitImportError(message, res?.status, body);
  }
  return data as T;
}

async function setConstant(key: string, value: string) {
  const store = useExpensifyStore.getState();
  const existing = store.getAppconstantByKey(key);
  if (existing) {
    const updated = await updateAppconstant({ ...existing, value });
    store.updateAppconstant(updated ?? { ...existing, value });
  } else {
    store.addAppconstant(await addAppconstant({ key, value }));
  }
}

async function deviceId(): Promise<string> {
  const existing = useExpensifyStore.getState().getAppconstantByKey(DEVICE_KEY)?.value;
  if (existing) return existing;
  const id = uuid.v4() as string;
  await setConstant(DEVICE_KEY, id);
  return id;
}

export function getPendingImport(): PendingImport | null {
  const raw = useExpensifyStore.getState().getAppconstantByKey(PENDING_KEY)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingImport;
  } catch {
    return null;
  }
}

const clearPending = () => setConstant(PENDING_KEY, "");

/** The bank to import into: the remembered one if it still exists, else the first live bank. */
export function defaultAccountId(): number | null {
  const { accounts, getAppconstantByKey } = useExpensifyStore.getState();
  const saved = Number(getAppconstantByKey(DEFAULT_ACCOUNT_KEY)?.value);
  if (saved && accounts[saved] && !accounts[saved].is_deleted) return saved;
  const first = Object.values(accounts)
    .filter((a) => !a.is_deleted)
    .sort((a, b) => a.id - b.id)[0];
  return first?.id ?? null;
}

export async function fetchUnlinkedSplits(
  meId: string,
  startDate?: string | null,
  endDate?: string | null,
): Promise<UnlinkedSplit[]> {
  const res = await invokeBackend(Action.FetchUnlinkedSplits, {
    me_id: meId,
    start_date: startDate ?? null,
    end_date: endDate ?? null,
  });
  return JSON.parse(res.data ?? "[]");
}

/** Hands the splits to the server. Returns once the job is queued. */
export async function startSplitImport(
  splits: UnlinkedSplit[],
  accountId: number,
): Promise<PendingImport> {
  if (getPendingImport()) throw new SplitImportError("An import is already in progress");
  const { categories, transactions } = useExpensifyStore.getState();
  const txns = Object.values(transactions);
  const items = buildStartItems(splits, historyMatches(txns, categories));
  if (items.length === 0) throw new SplitImportError("Nothing to import");
  if (items.length > MAX_IMPORT_SPLITS) {
    throw new SplitImportError(`Import at most ${MAX_IMPORT_SPLITS} splits at a time`);
  }
  const refs = categoryRefs(categories);
  if (refs.length === 0) throw new SplitImportError("Add a category first");

  const device = await deviceId();
  let pending: PendingImport;
  try {
    const { job_id } = await call<{ job_id: string }>({
      action: "start",
      device_id: device,
      account_id: accountId,
      categories: refs,
      merchants: buildMerchantMap(txns, categories),
      items,
    });
    pending = { job_id, account_id: accountId, total: items.length, started_at: new Date().toISOString() };
  } catch (e) {
    // A job this device started but lost track of (e.g. the response never
    // arrived): pick it back up instead of being blocked by it.
    const b = e instanceof SplitImportError && e.status === 409 ? e.body : null;
    if (b?.job_id && b.device_id === device) {
      const adopted: PendingImport = {
        job_id: b.job_id,
        account_id: b.account_id,
        total: b.total ?? 0,
        started_at: new Date().toISOString(),
      };
      await setConstant(PENDING_KEY, JSON.stringify(adopted));
      return adopted;
    }
    if (b?.job_id) {
      throw new SplitImportError("An import started on another device is still running. Try again later.", 409);
    }
    throw e;
  }
  await setConstant(PENDING_KEY, JSON.stringify(pending));
  await setConstant(DEFAULT_ACCOUNT_KEY, String(accountId));
  return pending;
}

let inflight: Promise<ImportStatus> | null = null;

/**
 * Checks the pending job and, if it's finished, applies it. Concurrent calls
 * (launch + foreground + notification) share one run.
 * `onApplied` refreshes the app's data after a successful apply.
 */
export function resumePendingImport(onApplied?: () => Promise<void>): Promise<ImportStatus> {
  if (!inflight) {
    inflight = doResume(onApplied).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

async function doResume(onApplied?: () => Promise<void>): Promise<ImportStatus> {
  const pending = getPendingImport();
  if (!pending) return { state: "idle" };

  let res: { job: any; items?: JobItem[] };
  try {
    res = await call({ action: "status", job_id: pending.job_id });
  } catch (e: any) {
    if (e instanceof SplitImportError && e.status === 404) {
      // Acked from an earlier run, or cancelled.
      await clearPending();
      return { state: "idle" };
    }
    return { state: "error", pending, message: e?.message ?? "Couldn't check the import" };
  }

  const job = res.job;
  if (job.status === "queued" || job.status === "running") {
    return { state: "running", pending, processed: job.processed ?? 0, total: job.total ?? pending.total };
  }

  // Category ids are local to the device that started the job.
  if (job.device_id !== (await deviceId())) {
    return { state: "error", pending, message: "This import was started on another device. Discard it and start again." };
  }

  const { categories } = useExpensifyStore.getState();
  const fallback = fallbackCategoryId(categories);
  if (fallback == null) {
    return { state: "error", pending, message: "Add a category first, then reopen this screen" };
  }
  const payload = buildApplyPayload(
    res.items ?? [],
    (job.new_categories ?? []) as JobNewCategory[],
    categories,
    fallback,
  );

  let result: ApplySplitImportResult = {
    already_applied: false,
    imported: 0,
    created_categories: 0,
    skipped: 0,
  };
  try {
    if (payload.items.length > 0) {
      const applied = await invokeBackend(Action.ApplySplitImport, {
        batch_id: job.id,
        account_id: job.account_id,
        ...payload,
      });
      result = JSON.parse(applied.data ?? "{}");
      const created = (applied.additions?.categories ?? []).map((c) => c.id);
      if (created.length > 0) await enqueueCategoryIcons(created);
    }
  } catch (e: any) {
    return { state: "error", pending, message: e?.message ?? "Couldn't add the transactions" };
  }

  // Only forget the job once the server has deleted it; if the ack fails,
  // the next run re-applies (a no-op) and acks again.
  try {
    await call({ action: "ack", job_id: job.id });
    await clearPending();
  } catch {
    /* retried next time */
  }
  const stoppedEarly: string | null =
    job.status === "failed" ? (job.error ?? "The import stopped early") : null;
  if (!result.already_applied) {
    await onApplied?.();
    announce(result, stoppedEarly);
  }
  generatePendingCategoryIcons().catch((e) => console.warn("[split-import] icons", e?.message ?? e));
  return { state: "applied", batchId: job.id, result, stoppedEarly };
}

function announce(result: ApplySplitImportResult, stoppedEarly: string | null) {
  const { imported, created_categories: created } = result;
  if (imported === 0 && !stoppedEarly) return;
  const what = `Imported ${imported} split${imported === 1 ? "" : "s"}`;
  const cats = created ? ` · ${created} new categor${created === 1 ? "y" : "ies"}` : "";
  const early = stoppedEarly ? `. ${stoppedEarly}; import the rest later` : "";
  toast(`${what}${cats}${early}`, stoppedEarly ? "info" : "success");
}

/** Abandons the pending job (server and local). Nothing is written locally. */
export async function discardPendingImport(): Promise<void> {
  const pending = getPendingImport();
  if (!pending) return;
  try {
    await call({ action: "cancel", job_id: pending.job_id });
  } catch (e) {
    if (!(e instanceof SplitImportError && e.status === 404)) throw e;
  }
  await clearPending();
}

// ── AI icons for imported categories ─────────────────────────────────────

function iconQueue(): number[] {
  const raw = useExpensifyStore.getState().getAppconstantByKey(ICON_QUEUE_KEY)?.value;
  try {
    const ids = JSON.parse(raw || "[]");
    return Array.isArray(ids) ? ids.filter((x) => Number.isInteger(x)) : [];
  } catch {
    return [];
  }
}

async function enqueueCategoryIcons(ids: number[]) {
  const queue = iconQueue();
  await setConstant(ICON_QUEUE_KEY, JSON.stringify([...queue, ...ids.filter((id) => !queue.includes(id))]));
}

const hasPlaceholderIcon = (id: number) => {
  const c = useExpensifyStore.getState().categories[id];
  return !!c && !c.is_deleted && c.icon_type === NEW_CATEGORY_ICON_TYPE && c.icon_name === PLACEHOLDER_CATEGORY_ICON;
};

let generating: Promise<void> | null = null;

/**
 * Generates an AI icon (same pipeline as the icon picker) for each queued
 * category the import created. Categories the user has since given an icon,
 * or deleted, are skipped. Stops on the daily icon limit or a network error
 * and resumes next time; a subject the icon model refuses keeps the
 * placeholder.
 */
export function generatePendingCategoryIcons(): Promise<void> {
  if (!generating) {
    generating = generateQueuedIcons().finally(() => {
      generating = null;
    });
  }
  return generating;
}

async function generateQueuedIcons() {
  for (let queue = iconQueue(); queue.length > 0; queue = iconQueue()) {
    const id = queue[0];
    if (hasPlaceholderIcon(id)) {
      const name = useExpensifyStore.getState().categories[id].name;
      try {
        const icon = await saveIcon(await generateIcon(name.slice(0, MAX_ICON_PROMPT)));
        // Re-read: the user may have picked an icon while this one generated.
        if (hasPlaceholderIcon(id)) {
          const latest = useExpensifyStore.getState().categories[id];
          const next = { ...latest, icon_name: icon.name, icon_type: icon.type };
          const updated = await editCategory(next);
          useExpensifyStore.getState().updateCategories(updated ?? next);
        }
      } catch (e) {
        const status = e instanceof AiError ? e.status : undefined;
        const retryLater = status === undefined || status === 401 || status === 429 || status >= 500;
        if (retryLater) return;
      }
    }
    await setConstant(ICON_QUEUE_KEY, JSON.stringify(iconQueue().filter((x) => x !== id)));
  }
}

export async function fetchImportBatches(): Promise<ImportBatchSummary[]> {
  const res = await invokeBackend(Action.FetchImportBatches, {});
  return JSON.parse(res.data ?? "[]");
}

export async function fetchImportBatch(batchId: string): Promise<ImportBatchItem[]> {
  const res = await invokeBackend(Action.FetchImportBatch, { batch_id: batchId });
  return JSON.parse(res.data ?? "[]");
}

export async function undoImportBatch(
  batchId: string,
): Promise<{ removed_transactions: number; removed_categories: number }> {
  const res = await invokeBackend(Action.UndoImportBatch, { batch_id: batchId });
  return JSON.parse(res.data ?? "{}");
}

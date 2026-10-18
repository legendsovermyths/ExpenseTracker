import { Image as ImageCompressor } from 'react-native-compressor';
import { Transaction } from '../types/entity/Transaction';
import { Category } from '../types/entity/Category';
import { Account } from '../types/entity/Account';
import { ParsedImageResult, ParsedTransaction } from '../types/entity/ParsedImageResult';
import { invokeBackend } from './api';
import { Action } from '../types/actions/actions';
import { supabase } from './Supabase';

export type AiTask = 'parse_receipt' | 'classify_document';

/** Thrown when the `ai` Edge Function refuses or fails; `status` 429 = daily limit. */
export class AiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

/**
 * Runs an AI task on the server (`supabase/functions/ai`). The OpenAI key,
 * model and prompts never ship in the app; this sends only the task's data
 * and returns the model's raw output text.
 */
export async function invokeAI(
  task: AiTask,
  payload: Record<string, unknown>,
): Promise<string | undefined> {
  const { data, error } = await supabase.functions.invoke('ai', {
    body: { task, ...payload },
  });
  if (error) {
    const res: Response | undefined = (error as any).context;
    let message = error.message;
    try {
      const body = await res?.json();
      if (body?.error) message = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new AiError(message, res?.status);
  }
  return typeof data?.text === 'string' ? data.text : undefined;
}

export function buildMerchantMap(
  transactions: Transaction[],
  categories: Record<number, Category>,
): string {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 3);

  const counts: Record<string, { category: string; sub?: string; count: number }> = {};

  for (const t of transactions) {
    if (new Date(t.date_time) < cutoff) continue;
    const desc = t.description?.trim();
    if (!desc) continue;
    const cat = categories[t.category_id];
    if (!cat) continue;
    const sub = t.subcategory_id ? categories[t.subcategory_id] : undefined;
    const key = desc.toLowerCase();
    if (!counts[key]) {
      counts[key] = { category: cat.name, sub: sub?.name, count: 0 };
    }
    counts[key].count++;
  }

  return Object.entries(counts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 50)
    .map(([desc, { category, sub, count }]) =>
      `${desc} → ${category}${sub ? ' > ' + sub : ''} (${count}x)`,
    )
    .join('\n');
}

export function buildAccountContext(accounts: Record<number, Account>): string {
  return Object.values(accounts)
    .filter((a) => !a.is_deleted)
    .map((a) => `${a.id}:${a.name}`)
    .join('\n');
}

export function buildCategoryContext(categories: Record<number, Category>): string {
  const parents = Object.values(categories).filter(
    (c) => !c.is_subcategory && !c.is_deleted,
  );
  return parents
    .map((p) => {
      const subs = Object.values(categories).filter(
        (c) => c.is_subcategory && c.parent_category === p.id && !c.is_deleted,
      );
      const subStr = subs.length
        ? ` [${subs.map((s) => `${s.id}:${s.name}`).join(', ')}]`
        : '';
      return `${p.id}:${p.name}${subStr}`;
    })
    .join('\n');
}

/**
 * Stable, deterministic content hash of an image (from its base64 bytes).
 * Pure JS (cyrb53) — no native dependency. Used as the image_parse_log key so
 * the same receipt maps to the same id even after the source file is overwritten.
 */
export function hashImageBase64(base64: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < base64.length; i++) {
    const ch = base64.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return `img_${base64.length.toString(36)}_${n.toString(16)}`;
}

export async function parseImage(
  imageUri: string,
  transactions: Record<number, Transaction>,
  categories: Record<number, Category>,
  accounts: Record<number, Account>,
): Promise<ParsedImageResult> {
  const compressed = await ImageCompressor.compress(imageUri, {
    compressionMethod: 'manual',
    maxWidth: 1024,
    maxHeight: 1024,
    quality: 0.6,
    output: 'jpg',
    returnableOutputType: 'base64',
  });
  const base64 = compressed.includes(',') ? compressed.slice(compressed.indexOf(',') + 1) : compressed;
  if (!base64) return { found: false };

  const imageHash = hashImageBase64(base64);
  // Attach the content hash to whatever result shape we return below.
  const done = (r: ParsedImageResult): ParsedImageResult => ({ ...r, imageHash });

  const merchantMap = buildMerchantMap(Object.values(transactions), categories);
  const categoryContext = buildCategoryContext(categories);
  const accountContext = buildAccountContext(accounts);

  const text = await invokeAI('parse_receipt', {
    image_b64: base64,
    today: new Date().toISOString().slice(0, 10),
    merchants: merchantMap,
    categories: categoryContext,
    accounts: accountContext,
  });
  if (!text) return done({ found: false });

  try {
    const parsed = JSON.parse(text) as ParsedImageResult;
    if (!parsed.found || !Array.isArray(parsed.transactions) || parsed.transactions.length === 0) {
      return done({ found: false });
    }
    return done(parsed);
  } catch {
    return done({ found: false });
  }
}

export type ImageParseStatus = 'pending' | 'done' | 'empty' | 'failed';

export interface BatchParseResult {
  /** All found transactions across every image, each tagged with its origin. */
  transactions: ParsedTransaction[];
  /** Per-image outcome, index-aligned with the input uris. */
  statuses: ImageParseStatus[];
  /** True when at least one image hit the server's daily AI limit. */
  limitReached: boolean;
}

/**
 * Parses multiple images in parallel. Failures and empty results are dropped
 * from `transactions` but reflected in `statuses` (index-aligned with `uris`).
 * `onImageSettled(index, status)` fires as each image resolves, for live UI.
 */
export async function parseImages(
  uris: string[],
  transactions: Record<number, Transaction>,
  categories: Record<number, Category>,
  accounts: Record<number, Account>,
  onImageSettled?: (index: number, status: ImageParseStatus) => void,
): Promise<BatchParseResult> {
  const statuses: ImageParseStatus[] = uris.map(() => 'pending');

  const settled = await Promise.allSettled(
    uris.map(async (uri, index) => {
      const result = await parseImage(uri, transactions, categories, accounts);
      const txns = result.found ? (result.transactions ?? []) : [];
      const status: ImageParseStatus = txns.length > 0 ? 'done' : 'empty';
      statuses[index] = status;
      onImageSettled?.(index, status);
      // Tag every txn with the image + raw LLM output it came from.
      const llmOutput = JSON.stringify(result);
      return txns.map((t) => ({
        ...t, __imageUri: uri, __imageHash: result.imageHash, __llmOutput: llmOutput,
      }));
    }),
  );

  const flattened: ParsedTransaction[] = [];
  let limitReached = false;
  settled.forEach((s, index) => {
    if (s.status === 'fulfilled') {
      flattened.push(...s.value);
    } else {
      if (s.reason instanceof AiError && s.reason.status === 429) limitReached = true;
      statuses[index] = 'failed';
      onImageSettled?.(index, 'failed');
    }
  });

  return { transactions: flattened, statuses, limitReached };
}

export async function storeImageParseLog(
  imageHash: string,
  llmOutput: string,
  transactionId: number,
): Promise<void> {
  try {
    await invokeBackend(Action.StoreImageParseLog, {
      image_hash: imageHash,
      llm_raw_output: llmOutput,
      transaction_id: transactionId,
    });
  } catch {
    // non-critical — don't block the user
  }
}

/** Parse a "YYYY-MM-DD" date string; returns new Date() if absent or invalid. */
export function parsePrefillDate(dateStr?: string): Date {
  if (!dateStr) return new Date();
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

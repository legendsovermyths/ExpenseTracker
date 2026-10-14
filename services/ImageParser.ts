import { Image as ImageCompressor } from 'react-native-compressor';
import Constants from 'expo-constants';
import { Transaction } from '../types/entity/Transaction';
import { Category } from '../types/entity/Category';
import { Account } from '../types/entity/Account';
import { ParsedImageResult, ParsedTransaction } from '../types/entity/ParsedImageResult';
import { invokeBackend } from './api';
import { Action } from '../types/actions/actions';

const OPENAI_MODEL = 'gpt-5.6-luna';

const OPENAI_API_KEY: string | undefined = Constants.expoConfig?.extra?.openAiApiKey;
const OPENAI_API_ENDPOINT: string | undefined = Constants.expoConfig?.extra?.openAiApiEndpoint;

async function generateContent(body: unknown): Promise<any> {
  if (!OPENAI_API_KEY || !OPENAI_API_ENDPOINT) {
    throw new Error('OpenAI API error: missing key or endpoint');
  }
  const response = await fetch(OPENAI_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }
  return await response.json();
}

function extractOutputText(data: any): string | undefined {
  const output = data?.output;
  if (!Array.isArray(output)) return undefined;
  for (const item of output) {
    if (item?.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part?.type === 'output_text' && typeof part.text === 'string') {
        return part.text;
      }
    }
  }
  return undefined;
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

  const today = new Date().toISOString().slice(0, 10);

  const prompt = `You are a financial transaction parser for an expense tracking app. Today's date is ${today}.

User's recent merchant history (last 3 months):
${merchantMap || 'No history yet'}

Available categories (format: id:name [subcategory_id:subcategory_name, ...]):
${categoryContext}

Available bank/payment accounts (format: id:name):
${accountContext}

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
      "account_id": 2,
    }
  ]
}

If the image does not contain any transaction, return: {"found": false}

Rules:
- A single bill or receipt is ONE transaction, amount is the total paid
- If there are multiple separate transactions, return each as a separate transaction
- Extract ALL visible transactions — if it is a history/statement screenshot, list every separate transaction shown
- date: use "YYYY-MM-DD" format. Infer year from context (assume current year if only day/month shown). Omit the field entirely if date is not visible
- amount is a plain number, no currency symbols
- is_credit is true for incoming money (salary, refund, received), false for expenses/payments
- Use category_id and subcategory_id exactly from the available categories list
- Use account_id from the available accounts — infer the bank/payment app aggressively using every available signal: explicit bank name or logo in the image, app UI style (Paytm's blue, PhonePe's purple, GPay's white/colourful, CRED's black), sender/receiver labels (e.g. "From: HDFC Bank"), UPI handle suffixes (e.g. @hdfcbank, @ybl for PhonePe, @oksbi for SBI, @okhdfcbank, @okaxis), account number hints, or watermarks. Never leave account_id empty — always pick the closest match from the available accounts
- Prefer matching description to merchant history for consistent categorisation
- description must be in Title Case (first letter of each word capitalised, rest lowercase) e.g. "Swiggy Food Order", "Amazon Purchase"
- Order transactions chronologically, newest first`;

  const body = {
    model: OPENAI_MODEL,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: prompt },
          {
            type: 'input_image',
            image_url: `data:image/jpeg;base64,${base64}`,
          },
        ],
      },
    ],
    text: { format: { type: 'json_object' } },
    reasoning: { effort: 'medium' },
  };

  const data = await generateContent(body);
  const text = extractOutputText(data);
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
  settled.forEach((s, index) => {
    if (s.status === 'fulfilled') {
      flattened.push(...s.value);
    } else {
      statuses[index] = 'failed';
      onImageSettled?.(index, 'failed');
    }
  });

  return { transactions: flattened, statuses };
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

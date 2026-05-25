import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import { Transaction } from '../types/entity/Transaction';
import { Category } from '../types/entity/Category';
import { Account } from '../types/entity/Account';
import { ParsedImageResult, ParsedTransaction } from '../types/entity/ParsedImageResult';
import { invokeBackend } from './api';
import { Action } from '../types/actions/actions';

const GEMINI_MODEL = 'gemini-3.1-flash-lite';
const GEMINI_URL = () => {
  const key = Constants.expoConfig?.extra?.geminiApiKey;
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
};

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

export async function parseImage(
  imageUri: string,
  transactions: Record<number, Transaction>,
  categories: Record<number, Category>,
  accounts: Record<number, Account>,
): Promise<ParsedImageResult> {
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

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
    contents: [
      {
        parts: [
          { text: prompt },
          { inline_data: { mime_type: 'image/jpeg', data: base64 } },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0.1,
    },
  };

  const response = await fetch(GEMINI_URL(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return { found: false };

  try {
    const parsed = JSON.parse(text) as ParsedImageResult;
    if (!parsed.found || !Array.isArray(parsed.transactions) || parsed.transactions.length === 0) {
      return { found: false };
    }
    return parsed;
  } catch {
    return { found: false };
  }
}

export async function storeImageParseLog(
  imageUri: string,
  llmOutput: string,
  transactionId: number,
): Promise<void> {
  try {
    await invokeBackend(Action.StoreImageParseLog, {
      image_hash: imageUri,
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

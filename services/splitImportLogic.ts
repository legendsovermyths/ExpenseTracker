// Pure helpers for "Import splits" (no React Native imports, so they run
// under Jest). The networking and storage side lives in SplitImport.ts.

import { Category } from "../types/entity/Category";
import { Transaction } from "../types/entity/Transaction";
import {
  ImportConfidence,
  ImportItem,
  NewImportCategory,
  UnlinkedSplit,
} from "../types/entity/SplitImport";

export const NEW_CATEGORY_ICON_TYPE = "material-community";
/** Shown until the category's AI icon is generated (see SplitImport.ts). */
export const PLACEHOLDER_CATEGORY_ICON = "shape-outline";
const MAX_DESCRIPTION = 200;

/** Supabase hands back `+00:00` offsets; transactions store `toISOString()`. */
function toIso(ts: string): string {
  const d = new Date(ts);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** Must match `normalizeDescription` in supabase/functions/split-import/categorize.mjs. */
export function normalizeDescription(s: string): string {
  const base = String(s ?? "").toLowerCase().normalize("NFKC");
  const cleaned = base.replace(/[0-9]+/g, " ").replace(/[^\p{L}]+/gu, " ").trim();
  return cleaned || base.trim();
}

export interface CategoryRef {
  id: number;
  name: string;
  parent_id: number | null;
}

/** Live categories in the shape the server expects; orphaned subcategories are dropped. */
export function categoryRefs(categories: Record<number, Category>): CategoryRef[] {
  const live = Object.values(categories).filter((c) => !c.is_deleted);
  const parents = new Set(live.filter((c) => !c.is_subcategory).map((c) => c.id));
  return live
    .filter((c) => !c.is_subcategory || parents.has(c.parent_category))
    .map((c) => ({
      id: c.id,
      name: c.name,
      parent_id: c.is_subcategory ? c.parent_category : null,
    }));
}

/** "Others" (or "Other"), else the oldest top-level category. */
export function fallbackCategoryId(categories: Record<number, Category>): number | null {
  const tops = Object.values(categories)
    .filter((c) => !c.is_deleted && !c.is_subcategory)
    .sort((a, b) => a.id - b.id);
  const named = tops.find((c) => /^others?$/i.test(c.name.trim()));
  return (named ?? tops[0])?.id ?? null;
}

/**
 * Categories the user has consistently used for a description before. A
 * description qualifies when at least 75% of its past transactions share one
 * category; those splits skip the AI entirely.
 */
export function historyMatches(
  transactions: Transaction[],
  categories: Record<number, Category>,
): Map<string, { category_id: number; subcategory_id: number | null }> {
  const tally = new Map<string, Map<string, number>>();
  for (const t of transactions) {
    if (t.is_credit || !t.description) continue;
    const cat = categories[t.category_id];
    if (!cat || cat.is_deleted) continue;
    const sub = t.subcategory_id ? categories[t.subcategory_id] : undefined;
    const subId = sub && !sub.is_deleted ? sub.id : null;
    const key = normalizeDescription(t.description);
    if (!key) continue;
    const counts = tally.get(key) ?? new Map<string, number>();
    const pair = `${cat.id}:${subId ?? ""}`;
    counts.set(pair, (counts.get(pair) ?? 0) + 1);
    tally.set(key, counts);
  }
  const out = new Map<string, { category_id: number; subcategory_id: number | null }>();
  tally.forEach((counts, key) => {
    let best = "";
    let bestN = 0;
    let total = 0;
    counts.forEach((n, pair) => {
      total += n;
      if (n > bestN) {
        best = pair;
        bestN = n;
      }
    });
    if (bestN / total < 0.75) return;
    const [c, s] = best.split(":");
    out.set(key, { category_id: Number(c), subcategory_id: s ? Number(s) : null });
  });
  return out;
}

export interface StartItem {
  entry_id: string;
  description: string;
  amount_cents: number;
  created_at: string;
  category_id?: number;
  subcategory_id?: number | null;
}

/** Splits → the `start` payload's items, pre-categorised from history where possible. */
export function buildStartItems(
  splits: UnlinkedSplit[],
  matches: Map<string, { category_id: number; subcategory_id: number | null }>,
): StartItem[] {
  return splits
    .filter((s) => s.owed_cents > 0)
    .map((s) => {
      const description = (s.description?.trim() || "Split").slice(0, MAX_DESCRIPTION);
      const match = matches.get(normalizeDescription(description));
      return {
        entry_id: s.entry_id,
        description,
        amount_cents: s.owed_cents,
        created_at: s.created_at,
        ...(match ? { category_id: match.category_id, subcategory_id: match.subcategory_id } : {}),
      };
    });
}

/** A finished item as returned by the `status` action. */
export interface JobItem {
  entry_id: string;
  description: string;
  amount_cents: number;
  entry_created_at: string;
  done: boolean;
  category_id: number | null;
  subcategory_id: number | null;
  new_category_key: string | null;
  confidence: ImportConfidence | null;
}

export interface JobNewCategory {
  key: string;
  name: string;
  parent_id: number | null;
}

/**
 * Turns a finished job into the SDK's apply payload. Unfinished items are
 * left out (their splits stay unlinked so they can be imported again), and
 * anything pointing at a category that no longer exists falls back to
 * `fallbackId` with low confidence. New categories get a placeholder icon;
 * their real one is generated afterwards.
 */
export function buildApplyPayload(
  items: JobItem[],
  proposed: JobNewCategory[],
  categories: Record<number, Category>,
  fallbackId: number,
): { new_categories: NewImportCategory[]; items: ImportItem[] } {
  const live = (id: number | null | undefined) =>
    id != null && categories[id] && !categories[id].is_deleted ? categories[id] : undefined;
  const proposals = new Map(proposed.map((p) => [p.key, p]));
  const used = new Set<string>();

  const out: ImportItem[] = items
    .filter((it) => it.done && it.amount_cents > 0)
    .map((it) => {
      const base = {
        entry_id: it.entry_id,
        description: it.description,
        amount: it.amount_cents / 100,
        date_time: toIso(it.entry_created_at),
      };
      if (it.new_category_key && proposals.has(it.new_category_key)) {
        used.add(it.new_category_key);
        return {
          ...base,
          category_id: null,
          subcategory_id: null,
          new_category_key: it.new_category_key,
          confidence: it.confidence ?? "medium",
        };
      }
      const cat = live(it.category_id);
      if (!cat) {
        return {
          ...base,
          category_id: fallbackId,
          subcategory_id: null,
          new_category_key: null,
          confidence: "low" as const,
        };
      }
      const sub = live(it.subcategory_id);
      const validSub = sub && sub.is_subcategory && sub.parent_category === cat.id;
      return {
        ...base,
        category_id: cat.id,
        subcategory_id: validSub ? sub.id : null,
        new_category_key: null,
        confidence: it.confidence ?? "medium",
      };
    });

  const newCategories: NewImportCategory[] = proposed
    .filter((p) => used.has(p.key))
    .map((p) => {
      const parent = live(p.parent_id);
      return {
        key: p.key,
        name: p.name,
        parent_id: parent && !parent.is_subcategory ? parent.id : null,
        icon_name: PLACEHOLDER_CATEGORY_ICON,
        icon_type: NEW_CATEGORY_ICON_TYPE,
      };
    });

  return { new_categories: newCategories, items: out };
}

import { Transaction } from "./Transaction";

/** A split I owe a share of that isn't a transaction yet (`fetch_unlinked_splits`). */
export interface UnlinkedSplit {
  entry_id: string;
  description: string | null;
  created_at: string;
  owed_cents: number;
  grp_name: string | null;
  counterpart_name: string | null;
}

export type ImportConfidence = "high" | "medium" | "low";

/** A category the AI proposed; items refer to it by `key`. */
export interface NewImportCategory {
  key: string;
  name: string;
  parent_id: number | null;
  icon_name: string;
  icon_type: string;
}

export interface ImportItem {
  entry_id: string;
  description: string;
  amount: number;
  date_time: string;
  category_id: number | null;
  subcategory_id: number | null;
  new_category_key: string | null;
  confidence: ImportConfidence | null;
}

export interface ApplySplitImportResult {
  already_applied: boolean;
  imported: number;
  created_categories: number;
  skipped: number;
}

export interface ImportBatchSummary {
  batch_id: string;
  created_at: string;
  account_id: number;
  count: number;
  total: number;
  created_categories: number;
}

export interface ImportBatchItem {
  entry_id: string;
  confidence: ImportConfidence | null;
  is_new_category: boolean;
  transaction: Transaction;
}

import { Account } from "../entity/Account";
import { Appconstant } from "../entity/Appconstant";
import { Category } from "../entity/Category";
import { CategoryBudget } from "../entity/CategoryBudget";
import { Fund } from "../entity/Fund";
import { FundEntry } from "../entity/FundEntry";
import { LedgerEntryRow } from "../entity/LedgerEntryRow";
import { LineItemRow } from "../entity/LineItemRow";
import { LiWithEntry } from "../entity/LiWithEntry";
import { NotificationRow } from "../entity/Notification";
import { Transaction } from "../entity/Transaction";
import { UserBalance } from "../entity/UserBalance";

/**
 * Mirrors the Rust `ChangeSet` struct (sdk/src/api/response.rs). Every field is
 * optional because the backend only populates the collections relevant to the
 * action that was invoked.
 */
export interface ChangeSet {
  transactions?: Transaction[];
  categories?: Category[];
  category_budgets?: CategoryBudget[];
  accounts?: Account[];
  appconstants?: Appconstant[];
  user_balances?: UserBalance[];
  li_with_entry?: LiWithEntry[];
  // No dedicated TS type exists for split summaries yet; typed loosely until one
  // is introduced. TODO: model SplitSummary and replace `any[]`.
  split_summary?: any[];
  ledger_entries?: LedgerEntryRow[];
  line_items?: LineItemRow[];
  notifications?: NotificationRow[];
  funds?: Fund[];
  fund_entries?: FundEntry[];
}

/**
 * Mirrors the Rust `Response` struct (sdk/src/api/response.rs) — the envelope
 * returned by every native backend call via `invokeBackend`.
 */
export interface BackendResponse {
  status?: string;
  message?: string;
  updates?: ChangeSet;
  additions?: ChangeSet;
  file?: number[];
  count?: number;
}

import { Account } from "../entity/Account";
import { Appconstant } from "../entity/Appconstant";
import { Category } from "../entity/Category";
import { LedgerEntryRow } from "../entity/LedgerEntryRow";
import { LineItemRow } from "../entity/LineItemRow";
import { Transaction } from "../entity/Transaction";
import { UserBalance } from "../entity/UserBalance";
import { CategoryBudget } from "../entity/CategoryBudget";

export enum Action {
  GetTransactions = "get_transactions",
  AddTransaction = "add_transaction",
  AddAccount = "add_account",
  AddCategory = "add_category",
  UpdateCategory = "update_category",
  DeleteCategory = "delete_category",
  GetData = "get_data",
  DeleteAccount = "delete_account",
  UpdateAccount = "update_account",
  UpdateTransaction = "update_transaction",
  UpdateUserBalances = "update_user_balances",
  DeleteTransaction = "delete_transaction",
  AddAppconstant = "add_appconstant",
  SyncSplitData = "sync_split_data",
  FetchFriendLedger = "fetch_friend_ledger",
  UpdateAppconstant = "update_appconstant",
  ExportData = "export_data",
  LinkTransactionToLedgerEntry = "link_transaction_to_ledger_entry",
  FetchSplitSummary = "fetch_split_summary",
  DeleteData = "delete_data",
  ImportData = "import_data",
  GetDirtySplitData = "get_dirty_split_data",
  InsertSplitData = "insert_split_data",
  DeleteSplit = "delete_split",
  UpsertCategoryBudget = "upsert_category_budget",
  DeleteCategoryBudget = "delete_category_budget",
  StoreImageParseLog = "store_image_parse_log",
}

export type Payloads = {
  [Action.GetTransactions]: GetTransactionsPayload;
  [Action.AddTransaction]: AddTransactionPayload;
  [Action.AddAccount]: AddAccountPayload;
  [Action.AddCategory]: AddCategoryPayload;
  [Action.GetData]: GetDataPayload;
  [Action.DeleteAccount]: DeleteAccountPayload;
  [Action.UpdateAccount]: UpdateAccountPayload;
  [Action.UpdateCategory]: UpdateCategoryPayload;
  [Action.DeleteCategory]: DeleteCategoryPayload;
  [Action.UpdateTransaction]: UpdateTransactionPayload;
  [Action.UpdateUserBalances]: UpdateUserBalancesPayload;
  [Action.DeleteTransaction]: DeleteTransactionPayload;
  [Action.AddAppconstant]: AddAppconstantPayload;
  [Action.UpdateAppconstant]: UpdateAppconstantPayload;
  [Action.SyncSplitData]: SyncSplitDataPayload;
  [Action.ExportData]: ExportDataPayload;
  [Action.ImportData]: ImportDataPayload;
  [Action.FetchSplitSummary]: FetchSplitSummaryPayload;
  [Action.FetchFriendLedger]: FetchFreindLedgerPayload;
  [Action.DeleteData]: DeleteDataPayload;
  [Action.LinkTransactionToLedgerEntry]: LinkTransactinPayload;
  [Action.InsertSplitData]: InsertSplitDataPayload;
  [Action.GetDirtySplitData]: GetDirtySplitDataPayload;
  [Action.DeleteSplit]: DeleteSplitPayload;
  [Action.UpsertCategoryBudget]: UpsertCategoryBudgetPayload;
  [Action.DeleteCategoryBudget]: DeleteCategoryBudgetPayload;
  [Action.StoreImageParseLog]: StoreImageParseLogPayload;
};

export interface SyncSplitDataPayload {
  ledger_entries: LedgerEntryRow[];
  line_items: LineItemRow[];
}

export interface FetchFreindLedgerPayload {
  me_id: string;
  friend_id: string;
}
export interface GetTransactionsPayload {
  limit?: number;
  filters?: Record<string, any>;
}

export interface AddTransactionPayload {
  transaction: Transaction;
}

export interface AddAccountPayload {
  account: Account;
}

export interface AddCategoryPayload {
  category: Category;
}

export interface GetDataPayload {}

export interface DeleteAccountPayload {
  account: Account;
}

export interface UpdateAccountPayload {
  account: Account;
}

export interface UpdateCategoryPayload {
  category: Category;
}

export interface DeleteCategoryPayload {
  category: Category;
}

export interface UpdateTransactionPayload {
  transaction: Transaction;
}

export interface DeleteTransactionPayload {
  transaction: Transaction;
}

export interface AddAppconstantPayload {
  appconstant: Appconstant;
}

export interface UpdateAppconstantPayload {
  appconstant: Appconstant;
}

export interface ExportDataPayload {}

export interface ImportDataPayload {
  file: number[];
}

export interface DeleteDataPayload {}

export interface UpdateUserBalancesPayload {
  user_balances: UserBalance[];
}

export interface LinkTransactinPayload {
  transaction_id: number;
  ledger_entry_id: string;
}

export interface FetchSplitSummaryPayload {
  entry_id: string;
}

export interface DeleteSplitPayload {
  entry_id: string;
}
export interface InsertSplitDataPayload {
  ledger_entries: LedgerEntryRow[];
  line_items: LineItemRow[];
}

export interface GetDirtySplitDataPayload {}

export interface UpsertCategoryBudgetPayload {
  category_budget: CategoryBudget;
}

export interface DeleteCategoryBudgetPayload {
  category_id: number;
}

export interface StoreImageParseLogPayload {
  image_hash: string;
  llm_raw_output: string;
  transaction_id: number;
}

import { Account } from "../entity/Account";
import { Appconstant } from "../entity/Appconstant";
import { Category } from "../entity/Category";
import { LedgerEntryRow } from "../entity/LedgerEntryRow";
import { LineItemRow } from "../entity/LineItemRow";
import { Transaction } from "../entity/Transaction";
import { UserBalance } from "../entity/UserBalance";

export enum Action {
  GetTransactions = "get_transactions",
  AddTransaction = "add_transaction",
  AddAccount = "add_account",
  AddCategory = "add_category",
  UpdateCategory = "update_category",
  DeleteCategory = "delete_category",
  GetData = "get_data",
  DeleteAccount = "delete_account",
  UpdateTransaction = "update_transaction",
  UpdateUserBalances = "update_user_balances",
  DeleteTransaction = "delete_transaction",
  AddAppconstant = "add_appconstant",
  SyncSplitData = "sync_split_data",
  FetchFriendLedger = "fetch_friend_ledger",
  UpdateAppconstant = "update_appconstant",
  ExportData = "export_data",
  LinkTransactionToLedgerEntry = "link_transaction_to_ledger_entry",
  DeleteData = "delete_data",
  ImportData = "import_data",
}

export type Payloads = {
  [Action.GetTransactions]: GetTransactionsPayload;
  [Action.AddTransaction]: AddTransactionPayload;
  [Action.AddAccount]: AddAccountPayload;
  [Action.AddCategory]: AddCategoryPayload;
  [Action.GetData]: GetDataPayload;
  [Action.DeleteAccount]: DeleteAccountPayload;
  [Action.UpdateCategory]: UpdateCategoryPayload;
  [Action.DeleteCategory]: DeleteCategoryPayload;
  [Action.UpdateTransaction]: UpdateTransactionPayload;
  [Action.UpdateUserBalances]: UpdateUserBalancesPayload;
  [Action.DeleteTransaction]: DeleteTransactionPayload;
  [Action.AddAppconstant]: AddAppconstantPayload;
  [Action.UpdateAppconstant]: UpdateAppconstantPayload;
  [Action.ExportData]: ExportDataPayload;
  [Action.ImportData]: ImportDataPayload;
  [Action.DeleteData]: DeleteDataPayload;
  [Action.LinkTransactionToLedgerEntry]: LinkTransactinPayload;
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

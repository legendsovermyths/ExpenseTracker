import { Account } from "../entity/Account";
import { Appconstant } from "../entity/Appconstant";
import { Category } from "../entity/Category";
import { Transaction } from "../entity/Transaction";

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
  DeleteTransaction = "delete_transaction",
  AddAppconstant = "add_appconstant",
  UpdateAppconstant = "update_appconstant",
  ExportData = "export_data",
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
  [Action.DeleteTransaction]: DeleteTransactionPayload;
  [Action.AddAppconstant]: AddAppconstantPayload;
  [Action.UpdateAppconstant]: UpdateAppconstantPayload;
  [Action.ExportData]: ExportDataPayload;
  [Action.ImportData]: ImportDataPayload;
  [Action.DeleteData]: DeleteDataPayload;
};

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

export interface GetDataPayload { }

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

export interface ExportDataPayload { }

export interface ImportDataPayload {
  file: number[];
}

export interface DeleteDataPayload { }

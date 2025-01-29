import { Account } from "../entity/Account";
import { Category } from "../entity/Category";
import { Transaction } from "../entity/Transaction";

export enum Action {
  GetTransactions = "get_transactions",
  AddTransaction = "add_transaction",
  AddAccount = "add_account",
  AddCategory = "add_category",
  GetData = "get_data",
}

export type Payloads = {
  [Action.GetTransactions]: GetTransactionsPayload;
  [Action.AddTransaction]: AddTransactionPayload;
  [Action.AddAccount]: AddAccountPayload;
  [Action.AddCategory]: AddCategoryPayload;
  [Action.GetData]: GetDataPayload;
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

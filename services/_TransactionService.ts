import { Action, AddTransactionPayload } from "../types/actions/actions";
import { Transaction } from "../types/transaction/Transaction";
import { invokeBackend } from "./api";

export const addTransaction = async(transaction: Transaction) => {
  const transactionPayload: AddTransactionPayload = {
    transaction: transaction,
  };
  await invokeBackend(Action.AddTransaction, transactionPayload);
};

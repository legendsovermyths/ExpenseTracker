import { Action, AddTransactionPayload } from "../types/actions/actions";
import { Transaction } from "../types/entity/Transaction";
import { invokeBackend } from "./api";

export const addTransaction = async(transaction: Transaction) => {
  const transactionPayload: AddTransactionPayload = {
    transaction: transaction,
  };
  let response = await invokeBackend(Action.AddTransaction, transactionPayload);
  const addedTransaction = response.additions.transactions[0];
  return addedTransaction;
};

import {
  Action,
  AddTransactionPayload,
  DeleteTransactionPayload,
  UpdateTransactionPayload,
} from "../types/actions/actions";
import { Transaction } from "../types/entity/Transaction";
import { invokeBackend } from "./api";

export const addTransaction = async (transaction: Transaction) => {
  const transactionPayload: AddTransactionPayload = {
    transaction: transaction,
  };
  let response = await invokeBackend(Action.AddTransaction, transactionPayload);
  const addedTransaction = response.additions.transactions[0];
  return addedTransaction;
};

export const updateTransaction = async (transaction: Transaction) => {
  const transactionPayload: UpdateTransactionPayload = {
    transaction: transaction,
  };
  let response = await invokeBackend(
    Action.UpdateTransaction,
    transactionPayload,
  );
  const updatedTransaction = response.updates.transactions[0];
  return updatedTransaction;
};

//TODO: need to handle the case if the delete fails for some reason
export const deleteTransaction = async (transaction: Transaction) => {
  const transactionPayload: DeleteTransactionPayload = {
    transaction: transaction,
  };
  let response = await invokeBackend(
    Action.DeleteTransaction,
    transactionPayload,
  );
};

import {
  Action,
  AddAccountPayload,
  DeleteAccountPayload,
} from "../types/actions/actions";
import { Account } from "../types/entity/Account";
import { Transaction } from "../types/entity/Transaction";
import { invokeBackend } from "./api";

export const addAccount = async (account: Account) => {
  const addAccountPayload: AddAccountPayload = {
    account: account,
  };
  const response = await invokeBackend(Action.AddAccount, addAccountPayload);
  return response.additions.accounts[0];
};

export const deleteAccount = async (account: Account) => {
  const deleteAccountPayload: DeleteAccountPayload = {
    account: account,
  };
  const response = await invokeBackend(
    Action.DeleteAccount,
    deleteAccountPayload,
  );
  return response;
};

export const analyzeAccountTransactions = (
  transactions: Transaction[],
  accounts: Account[],
) => {
  const accountStats = new Map<number, [number, number, number]>();

  accounts.forEach((account) => {
    accountStats.set(account.id, [0, 0, 0]);
  });
  transactions.forEach(({ account_id, amount, is_credit }) => {
    if (accountStats.has(account_id)) {
      const [numTransactions, totalExpenditure, totalIncome] =
        accountStats.get(account_id)!;
      accountStats.set(account_id, [
        numTransactions + 1,
        totalExpenditure + (is_credit ? 0 : amount),
        totalIncome + (is_credit ? amount : 0),
      ]);
    }
  });

  return accounts.map(({ id }) => accountStats.get(id)!);
};

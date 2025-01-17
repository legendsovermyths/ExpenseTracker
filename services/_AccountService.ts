import { Action, AddAccountPayload } from "../types/actions/actions";
import { Account } from "../types/transaction/Account";
import { invokeBackend } from "./api";

export const addAccount = (account: Account) => {
  const addAccountPayload: AddAccountPayload = {
    account: account,
  };
  invokeBackend(Action.AddAccount, addAccountPayload);
};

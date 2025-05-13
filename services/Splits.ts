import { Action, UpdateUserBalancesPayload } from "../types/actions/actions";
import { UserBalance } from "../types/entity/UserBalance";
import { invokeBackend } from "./api";

export const updateUserBalances = async (userBalances: UserBalance[]) => {
  const updateUserBalancesPayload: UpdateUserBalancesPayload = {
    user_balances: userBalances,
  };
  const response = await invokeBackend(
    Action.UpdateUserBalances,
    updateUserBalancesPayload,
  );
  return response;
};

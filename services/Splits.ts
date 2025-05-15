import {
  Action,
  FetchFreindLedgerPayload,
  SyncSplitDataPayload,
  UpdateUserBalancesPayload,
} from "../types/actions/actions";
import { LedgerEntryRow } from "../types/entity/LedgerEntryRow";
import { LineItemRow } from "../types/entity/LineItemRow";
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

export const syncSplitData = async (
  ledgerEnteries: LedgerEntryRow[],
  lineItems: LineItemRow[],
) => {
  const syncSplitDataPayload: SyncSplitDataPayload = {
    line_items: lineItems,
    ledger_entries: ledgerEnteries,
  };
  const response = await invokeBackend(
    Action.SyncSplitData,
    syncSplitDataPayload,
  );
  return response;
};

export const fetchFriendLedger = async (meId: string, friendId: string) => {
  const fetchFreindLedgerPayload: FetchFreindLedgerPayload = {
    me_id: meId,
    friend_id: friendId,
  };
  const response = await invokeBackend(
    Action.FetchFriendLedger,
    fetchFreindLedgerPayload,
  );
  return response.additions.li_with_entry;
};

import {
  Action,
  FetchFreindLedgerPayload,
  FetchSplitSummaryPayload,
  GetDirtySplitDataPayload,
  InsertSplitDataPayload,
  LinkTransactinPayload,
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

export const addSplitData = async (
  ledgerEnteries: LedgerEntryRow[],
  lineItems: LineItemRow[],
) => {
  const addSplitDataPayload: InsertSplitDataPayload = {
    line_items: lineItems,
    ledger_entries: ledgerEnteries,
  };
  const response = await invokeBackend(
    Action.InsertSplitData,
    addSplitDataPayload,
  );
  return response;
};

export const getDirtySplitData = async () => {
  const getDirtySplitDataPayload: GetDirtySplitDataPayload = {};
  const response = await invokeBackend(
    Action.GetDirtySplitData,
    getDirtySplitDataPayload,
  );
  return {
    line_item: response.updates.line_items,
    ledger_entries: response.updates.ledger_entries,
  };
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
export const linkTransactionToLedgerEntry = async (
  transactionId: number,
  ledgerEntryId: string,
) => {
  const linkTransactionPayload: LinkTransactinPayload = {
    ledger_entry_id: ledgerEntryId,
    transaction_id: transactionId,
  };
  const response = await invokeBackend(
    Action.LinkTransactionToLedgerEntry,
    linkTransactionPayload,
  );
  return response;
};

export const fetchSplitSummary = async (entryId: string) => {
  const fetchSplitSummaryPayload: FetchSplitSummaryPayload = {
    entry_id: entryId,
  };
  const response = await invokeBackend(
    Action.FetchSplitSummary,
    fetchSplitSummaryPayload,
  );
  return response.additions.split_summary[0];
};

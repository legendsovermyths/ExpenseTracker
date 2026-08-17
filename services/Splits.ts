import {
  Action,
  DeleteSplitPayload,
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
import { supabase } from "./Supabase";

// Pulled out of BalanceScreen.tsx so it can also be called from App.tsx's
// notification realtime handler — that path needs to push fresh balances
// straight into the store the moment a notification arrives, not just wait
// for BalanceScreen's own focus effect (which only fires if that screen
// happens to be mounted/focused when the event lands).
export const fetchUserBalances = async (): Promise<UserBalance[]> => {
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) throw authErr || new Error("Not authenticated");
  const me = user.id;

  const { data: bal, error: balErr } = await supabase
    .from("balance_pair_me")
    .select("user_lo,user_hi,net_cents");
  if (balErr) throw balErr;
  if (!bal) return [];

  const friendIds = bal.map((r) => (r.user_lo === me ? r.user_hi : r.user_lo));

  const { data: friends, error: frErr } = await supabase
    .from("profiles")
    .select("id,full_name")
    .in("id", friendIds);
  if (frErr) throw frErr;

  const nameMap: Record<string, string> = {};
  friends?.forEach((f) => (nameMap[f.id] = f.full_name));

  return bal.map((r) => {
    const friendId = r.user_lo === me ? r.user_hi : r.user_lo;
    const signed = r.user_lo === me ? r.net_cents : -r.net_cents;
    return {
      id: friendId,
      name: nameMap[friendId] || "Unknown",
      net_cents: signed,
    };
  });
};

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
    line_item: response.updates?.line_items || [],
    ledger_entries: response.updates?.ledger_entries || [],
  };
};

export const fetchFriendLedger = async (
  meId: string,
  friendId: string,
  startDate?: string,
  endDate?: string,
) => {
  const fetchFreindLedgerPayload: FetchFreindLedgerPayload = {
    me_id: meId,
    friend_id: friendId,
    start_date: startDate,
    end_date: endDate,
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

export const deleteSplit = async(entryId: string) =>{
  const deleteSplitPayload: DeleteSplitPayload = {
    entry_id: entryId,
  }
  const response = await invokeBackend(Action.DeleteSplit, deleteSplitPayload);
  return response;
}

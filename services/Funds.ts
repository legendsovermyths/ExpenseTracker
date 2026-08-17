import {
  Action,
  AddFundEntryPayload,
  DeleteFundEntryPayload,
  DeleteFundPayload,
  FetchFundDetailPayload,
  FetchFundsPayload,
  GetDirtyFundDataPayload,
  SyncFundDataPayload,
  UpdateFundEntryPayload,
  UpsertFundPayload,
} from "../types/actions/actions";
import { Fund } from "../types/entity/Fund";
import { FundEntry } from "../types/entity/FundEntry";
import { invokeBackend } from "./api";

export const upsertFund = async (fund: Fund) => {
  const payload: UpsertFundPayload = { fund };
  const response = await invokeBackend(Action.UpsertFund, payload);
  return response.additions?.funds?.[0] as Fund;
};

export const deleteFund = async (fundId: string) => {
  const payload: DeleteFundPayload = { fund_id: fundId };
  const response = await invokeBackend(Action.DeleteFund, payload);
  return response;
};

export const fetchFunds = async (userId: string) => {
  const payload: FetchFundsPayload = { user_id: userId };
  const response = await invokeBackend(Action.FetchFunds, payload);
  return (response.additions?.funds ?? []) as Fund[];
};

export const fetchFundDetail = async (fundId: string) => {
  const payload: FetchFundDetailPayload = { fund_id: fundId };
  const response = await invokeBackend(Action.FetchFundDetail, payload);
  return {
    fund: response.additions?.funds?.[0] as Fund,
    entries: (response.additions?.fund_entries ?? []) as FundEntry[],
    totalContributedCents: (response.count ?? 0) as number,
  };
};

export const addFundEntry = async (entry: FundEntry) => {
  const payload: AddFundEntryPayload = { entry };
  const response = await invokeBackend(Action.AddFundEntry, payload);
  return response.additions?.fund_entries?.[0] as FundEntry;
};

export const updateFundEntry = async (entry: FundEntry) => {
  const payload: UpdateFundEntryPayload = { entry };
  const response = await invokeBackend(Action.UpdateFundEntry, payload);
  return response.additions?.fund_entries?.[0] as FundEntry;
};

export const deleteFundEntry = async (entryId: string) => {
  const payload: DeleteFundEntryPayload = { entry_id: entryId };
  const response = await invokeBackend(Action.DeleteFundEntry, payload);
  return response;
};

export const getDirtyFundData = async () => {
  const payload: GetDirtyFundDataPayload = {};
  const response = await invokeBackend(Action.GetDirtyFundData, payload);
  return {
    funds: (response.updates?.funds ?? []) as Fund[],
    entries: (response.updates?.fund_entries ?? []) as FundEntry[],
  };
};

export const syncFundData = async (funds: Fund[], entries: FundEntry[]) => {
  const payload: SyncFundDataPayload = { funds, entries };
  const response = await invokeBackend(Action.SyncFundData, payload);
  return response;
};

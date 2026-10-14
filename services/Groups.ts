import {
  Action,
  DeleteGroupPayload,
  FetchGroupDetailPayload,
  FetchGroupsPayload,
  GetDirtyGroupDataPayload,
  SyncGroupDataPayload,
  UpsertGroupPayload,
} from "../types/actions/actions";
import {
  Group,
  GroupDetail,
  GroupMember,
  GroupSummary,
} from "../types/entity/Group";
import { invokeBackend } from "./api";

export const upsertGroup = async (group: Group, members: GroupMember[]) => {
  const payload: UpsertGroupPayload = { group, members };
  const response = await invokeBackend(Action.UpsertGroup, payload);
  return response.additions?.groups?.[0] as Group;
};

export const deleteGroup = async (grpId: string) => {
  const payload: DeleteGroupPayload = { grp_id: grpId };
  return invokeBackend(Action.DeleteGroup, payload);
};

export const fetchGroups = async (userId: string): Promise<GroupSummary[]> => {
  const payload: FetchGroupsPayload = { user_id: userId };
  const response = await invokeBackend(Action.FetchGroups, payload);
  return (response.additions?.group_summaries ?? []) as GroupSummary[];
};

export const fetchGroupDetail = async (
  grpId: string,
  meId: string,
): Promise<GroupDetail> => {
  const payload: FetchGroupDetailPayload = { grp_id: grpId, me_id: meId };
  const response = await invokeBackend(Action.FetchGroupDetail, payload);
  return response.additions?.group_details?.[0] as GroupDetail;
};

export const getDirtyGroupData = async () => {
  const payload: GetDirtyGroupDataPayload = {};
  const response = await invokeBackend(Action.GetDirtyGroupData, payload);
  return {
    groups: (response.updates?.groups ?? []) as Group[],
    members: (response.updates?.group_members ?? []) as GroupMember[],
  };
};

export const syncGroupData = async (groups: Group[], members: GroupMember[]) => {
  const payload: SyncGroupDataPayload = { groups, members };
  return invokeBackend(Action.SyncGroupData, payload);
};

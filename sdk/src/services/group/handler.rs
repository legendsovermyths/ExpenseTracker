use serde_json::Value;

use crate::api::js_handler::handle;

use super::{
    model::{
        DeleteGroupPayload, DeletedGroup, FetchGroupDetailPayload, FetchGroupsPayload,
        FetchedGroupDetail, FetchedGroups, GetDirtyGroupDataPayload, GetDirtyGroupDataSuccess,
        SyncGroupDataPayload, SyncedGroupData, UpsertGroupPayload, UpsertedGroup,
    },
    service::{
        delete_group, fetch_group_detail, fetch_groups, get_dirty_group_data, sync_group_data,
        upsert_group,
    },
};

pub fn upsert_group_jshandler(payload: Option<Value>) -> Value {
    handle::<UpsertGroupPayload, UpsertedGroup, _>(payload, |p| {
        Ok(UpsertedGroup(upsert_group(p.group, p.members)?))
    })
}

pub fn delete_group_jshandler(payload: Option<Value>) -> Value {
    handle::<DeleteGroupPayload, DeletedGroup, _>(payload, |p| {
        let updated_at = chrono::Utc::now().to_rfc3339();
        delete_group(&p.grp_id, &updated_at)?;
        Ok(DeletedGroup)
    })
}

pub fn fetch_groups_jshandler(payload: Option<Value>) -> Value {
    handle::<FetchGroupsPayload, FetchedGroups, _>(payload, |p| {
        Ok(FetchedGroups(fetch_groups(&p.user_id)?))
    })
}

pub fn fetch_group_detail_jshandler(payload: Option<Value>) -> Value {
    handle::<FetchGroupDetailPayload, FetchedGroupDetail, _>(payload, |p| {
        Ok(FetchedGroupDetail(fetch_group_detail(&p.grp_id, &p.me_id)?))
    })
}

pub fn get_dirty_group_data_jshandler(payload: Option<Value>) -> Value {
    handle::<GetDirtyGroupDataPayload, GetDirtyGroupDataSuccess, _>(payload, |_| {
        let (groups, members) = get_dirty_group_data()?;
        Ok(GetDirtyGroupDataSuccess { groups, members })
    })
}

pub fn sync_group_data_jshandler(payload: Option<Value>) -> Value {
    handle::<SyncGroupDataPayload, SyncedGroupData, _>(payload, |p| {
        sync_group_data(p.groups, p.members)?;
        Ok(SyncedGroupData)
    })
}

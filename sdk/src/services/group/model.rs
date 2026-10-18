use serde::{Deserialize, Serialize};

use crate::api::response::{Entity, IntoResponse, Response};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GroupRow {
    pub id: String,
    pub name: String,
    pub created_by: String,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub is_deleted: bool,
    #[serde(default)]
    pub icon_name: Option<String>,
    #[serde(default)]
    pub icon_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GroupMemberRow {
    pub grp_id: String,
    pub user_id: String,
    // Local-only display name (resolved from `profiles` on sync).
    #[serde(default)]
    pub user_name: Option<String>,
    pub joined_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub is_deleted: bool,
}

/// One row of the Groups list.
#[derive(Debug, Serialize, Deserialize)]
pub struct GroupSummary {
    pub group: GroupRow,
    pub members: Vec<GroupMemberRow>,
    /// Sum of my line items across the group's expenses. Positive ⇒ the
    /// group owes me overall.
    pub my_net_cents: i64,
    pub last_activity_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GroupExpense {
    pub entry_id: String,
    pub description: Option<String>,
    pub created_at: String,
    pub kind: String,
    pub total_cents: i64,
    pub created_by: Option<String>,
    pub transaction_id: Option<usize>,
    pub is_dirty: bool,
    /// My paid − owed for this expense (0 if I'm not part of it).
    pub my_net_cents: i64,
    pub payer_ids: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GroupMemberBalance {
    pub user_id: String,
    /// What this member owes me from the group's expenses. Positive ⇒ they
    /// owe me.
    pub net_cents: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GroupDetail {
    pub group: GroupRow,
    pub members: Vec<GroupMemberRow>,
    pub expenses: Vec<GroupExpense>,
    pub member_balances: Vec<GroupMemberBalance>,
    pub my_net_cents: i64,
    pub total_spent_cents: i64,
}

// ---- Upsert (local create/edit) ---------------------------------------------
#[derive(Debug, Deserialize)]
pub struct UpsertGroupPayload {
    pub group: GroupRow,
    pub members: Vec<GroupMemberRow>,
}
pub struct UpsertedGroup(pub GroupRow);
impl IntoResponse for UpsertedGroup {
    fn write_into(self, r: &mut Response) {
        r.push_addition(Entity::Group(self.0));
    }
}

#[derive(Debug, Deserialize)]
pub struct DeleteGroupPayload {
    pub grp_id: String,
}
pub struct DeletedGroup;
impl IntoResponse for DeletedGroup {
    fn write_into(self, _r: &mut Response) {}
}

// ---- Fetch --------------------------------------------------------------------
#[derive(Debug, Deserialize)]
pub struct FetchGroupsPayload {
    pub user_id: String,
}
pub struct FetchedGroups(pub Vec<GroupSummary>);
impl IntoResponse for FetchedGroups {
    fn write_into(self, r: &mut Response) {
        for g in self.0 {
            r.push_addition(Entity::GroupSummary(g));
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct FetchGroupDetailPayload {
    pub grp_id: String,
    pub me_id: String,
}
pub struct FetchedGroupDetail(pub GroupDetail);
impl IntoResponse for FetchedGroupDetail {
    fn write_into(self, r: &mut Response) {
        r.push_addition(Entity::GroupDetail(self.0));
    }
}

// ---- Sync ---------------------------------------------------------------------
#[derive(Debug, Deserialize, Default)]
pub struct GetDirtyGroupDataPayload {}
pub struct GetDirtyGroupDataSuccess {
    pub groups: Vec<GroupRow>,
    pub members: Vec<GroupMemberRow>,
}
impl IntoResponse for GetDirtyGroupDataSuccess {
    fn write_into(self, r: &mut Response) {
        for g in self.groups {
            r.push_update(Entity::Group(g));
        }
        for m in self.members {
            r.push_update(Entity::GroupMember(m));
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct SyncGroupDataPayload {
    pub groups: Vec<GroupRow>,
    pub members: Vec<GroupMemberRow>,
}
pub struct SyncedGroupData;
impl IntoResponse for SyncedGroupData {
    fn write_into(self, _r: &mut Response) {}
}

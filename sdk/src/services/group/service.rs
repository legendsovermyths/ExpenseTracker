use std::error::Error;

use super::{
    db_utils::{
        get_dirty_group_data_from_database, get_group_detail_from_database,
        get_groups_for_user_from_database, soft_delete_group_in_database,
        sync_groups_in_database, upsert_group_with_members_in_database,
    },
    model::{GroupDetail, GroupMemberRow, GroupRow, GroupSummary},
};

pub fn upsert_group(group: GroupRow, members: Vec<GroupMemberRow>) -> Result<GroupRow, Box<dyn Error>> {
    upsert_group_with_members_in_database(&group, &members, true)?;
    Ok(group)
}

pub fn delete_group(grp_id: &str, updated_at: &str) -> Result<(), Box<dyn Error>> {
    soft_delete_group_in_database(grp_id, updated_at)
}

pub fn fetch_groups(user_id: &str) -> Result<Vec<GroupSummary>, Box<dyn Error>> {
    get_groups_for_user_from_database(user_id)
}

pub fn fetch_group_detail(grp_id: &str, me_id: &str) -> Result<GroupDetail, Box<dyn Error>> {
    get_group_detail_from_database(grp_id, me_id)
}

pub fn get_dirty_group_data() -> Result<(Vec<GroupRow>, Vec<GroupMemberRow>), Box<dyn Error>> {
    get_dirty_group_data_from_database()
}

pub fn sync_group_data(groups: Vec<GroupRow>, members: Vec<GroupMemberRow>) -> Result<(), Box<dyn Error>> {
    sync_groups_in_database(&groups, &members)
}

use serde::{Deserialize, Serialize};

use crate::api::response::{Entity, IntoResponse};

use super::{ledger_entry::model::LedgerEntryRow, line_item::model::LineItemRow};

#[derive(Debug, Serialize, Deserialize)]
pub struct LiWithEntry {
    pub entry_id: String,
    pub user_id: String,
    pub amount_cents: i64,
    pub description: Option<String>,
    pub created_at: String,
    pub kind: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct UpsertSplitPayload {
    pub ledger_entries: Vec<LedgerEntryRow>,
    pub line_items: Vec<LineItemRow>,
}
#[derive(Deserialize, Serialize, Debug)]
pub struct FetchLiWithEntryPayload {
    pub me_id: String,
    pub friend_id: String,
}

pub struct UpsertSplitSuccess;

impl IntoResponse for UpsertSplitSuccess {
    fn write_into(self, _r: &mut crate::api::response::Response) {}
}

pub struct FetchedLiWithEntry(pub Vec<LiWithEntry>);

impl IntoResponse for FetchedLiWithEntry {
    fn write_into(self, r: &mut crate::api::response::Response) {
        for item in self.0.into_iter() {
            r.push_addition(Entity::LiWithEntry(item));
        }
    }
}

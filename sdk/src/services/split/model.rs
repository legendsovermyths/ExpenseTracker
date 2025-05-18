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
    pub transaction_id: Option<usize>,
}
#[derive(Debug, Serialize, Deserialize)]
pub struct LineItemInfo {
    pub user_id: String,
    pub amount_cents: i64,
    pub paid_cents: i64,
    pub owed_cents: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SplitSummary {
    pub description: Option<String>,
    pub items: Vec<LineItemInfo>,
    pub transaction_id: Option<usize>
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
#[derive(Deserialize, Serialize, Debug)]
pub struct FetchSplitSummaryPayload {
    pub entry_id: String,
}
pub struct FetchedSplitSummary(pub SplitSummary);
pub struct UpsertSplitSuccess;

impl IntoResponse for UpsertSplitSuccess {
    fn write_into(self, _r: &mut crate::api::response::Response) {}
}

impl IntoResponse for FetchedSplitSummary{
    fn write_into(self, r: &mut crate::api::response::Response) {
        r.push_addition(Entity::SplitSummary(self.0));
    }
}

pub struct FetchedLiWithEntry(pub Vec<LiWithEntry>);

impl IntoResponse for FetchedLiWithEntry {
    fn write_into(self, r: &mut crate::api::response::Response) {
        for item in self.0.into_iter() {
            r.push_addition(Entity::LiWithEntry(item));
        }
    }
}

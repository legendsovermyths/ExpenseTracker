use serde::{Deserialize, Serialize};

use crate::api::response::IntoResponse;

#[derive(Serialize, Deserialize, Debug)]
pub struct LedgerEntryRow {
    pub id: String,
    pub kind: String,
    pub description: Option<String>,
    pub created_by: String,
    pub created_at: String,
    pub total_cents: i64,
    pub updated_at: String,
    pub transaction_id: Option<i64>,
    pub is_deleted: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct LinkTransactionPayload {
    pub transaction_id: usize,
    pub ledger_entry_id: String,
}

pub struct LinkedTransactionToLedgerEntry;

impl IntoResponse for LinkedTransactionToLedgerEntry {
    fn write_into(self, _r: &mut crate::api::response::Response) {}
}

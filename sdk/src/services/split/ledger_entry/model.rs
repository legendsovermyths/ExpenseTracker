use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct LedgerEntryRow {
    pub id:            String,
    pub kind:          String,
    pub description:   Option<String>,
    pub created_by:    String,
    pub total_cents:   i64,
    pub updated_at:    String,
    pub transaction_id: Option<i64>,      
}

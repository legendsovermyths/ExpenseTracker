use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct LineItemRow {
    pub entry_id:     String,
    pub user_id:      String,
    pub amount_cents: i64,
    pub paid_cents:   i64,
    pub owed_cents:   i64,
    pub updated_at:   String,
}


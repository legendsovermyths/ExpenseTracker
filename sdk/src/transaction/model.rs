use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
pub struct Transaction {
    pub id: Option<u32>,
    pub description: String,
    pub amount: f64,
    pub account_id: u32,
    pub category_id: u32,
    pub subcategory_id: Option<u32>,
    pub date_time: String,
    pub is_credit:bool
}

#[derive(Debug, Deserialize)]
pub struct TransactionPayload {
    pub transaction: Transaction,
}

#[derive(Debug, Deserialize)]
pub struct TransactionPayloadWrapper {
    pub payload: TransactionPayload,
}

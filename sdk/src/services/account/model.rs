use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
pub struct Account {
    pub id: Option<u32>,
    pub amount: f64,
    pub name: String,
    pub is_credit: bool,
    pub date_time: String,
    pub theme: String,
    pub due_date: Option<String>,
    pub frequency: Option<String>,
    pub is_deleted: bool,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct AccountPayload {
    pub account: Account,
}

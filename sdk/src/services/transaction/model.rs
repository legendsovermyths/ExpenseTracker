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

#[derive(Debug, Deserialize, Default)]
pub struct GetTransactionsPayload {
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub search_text: Option<String>,
    pub limit: Option<i64>,
}

pub struct FetchedTransactions(pub Vec<Transaction>);

impl crate::api::response::IntoResponse for FetchedTransactions {
    fn write_into(self, r: &mut crate::api::response::Response) {
        for transaction in self.0.into_iter() {
            r.push_addition(crate::api::response::Entity::Transaction(transaction));
        }
    }
}

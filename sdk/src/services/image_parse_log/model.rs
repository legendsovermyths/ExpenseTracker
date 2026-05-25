use serde::{Deserialize, Serialize};
use crate::api::response::IntoResponse;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImageParseLog {
    pub id: Option<i64>,
    pub image_hash: String,
    pub llm_raw_output: String,
    pub transaction_id: Option<i64>,
    pub created_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct StoreImageParseLogPayload {
    pub image_hash: String,
    pub llm_raw_output: String,
    pub transaction_id: Option<i64>,
}

pub struct ImageParseLogStored;

impl IntoResponse for ImageParseLogStored {
    fn write_into(self, _r: &mut crate::api::response::Response) {}
}

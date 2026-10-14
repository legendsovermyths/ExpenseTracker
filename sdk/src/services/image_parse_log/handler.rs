use serde_json::Value;
use crate::api::js_handler::handle;
use super::model::{StoreImageParseLogPayload, ImageParseLogStored};
use super::service::store_image_parse_log;

pub fn store_image_parse_log_jshandler(payload: Option<Value>) -> Value {
    handle::<StoreImageParseLogPayload, ImageParseLogStored, _>(payload, |p| {
        store_image_parse_log(p.image_hash, p.llm_raw_output, p.transaction_id)?;
        Ok(ImageParseLogStored)
    })
}

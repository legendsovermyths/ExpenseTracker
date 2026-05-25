use std::error::Error;
use chrono::Utc;
use super::model::ImageParseLog;
use super::db_utils::insert_image_parse_log;

pub fn store_image_parse_log(
    image_hash: String,
    llm_raw_output: String,
    transaction_id: Option<i64>,
) -> Result<(), Box<dyn Error>> {
    let log = ImageParseLog {
        id: None,
        image_hash,
        llm_raw_output,
        transaction_id,
        created_at: Utc::now().timestamp(),
    };
    insert_image_parse_log(&log)?;
    Ok(())
}

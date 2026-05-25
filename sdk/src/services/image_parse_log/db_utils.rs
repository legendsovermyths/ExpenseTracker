use rusqlite::params;
use std::error::Error;
use crate::services::database::DB;
use super::model::ImageParseLog;

pub fn insert_image_parse_log(log: &ImageParseLog) -> Result<i64, Box<dyn Error>> {
    let conn = DB.get_connection()?;
    conn.execute(
        "INSERT INTO image_parse_log (image_hash, llm_raw_output, transaction_id, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![log.image_hash, log.llm_raw_output, log.transaction_id, log.created_at],
    )?;
    Ok(conn.last_insert_rowid())
}

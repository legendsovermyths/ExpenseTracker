use rusqlite::params;

use crate::services::database::DB;

use super::model::LiWithEntry;

pub fn fetch_friend_ledger_from_database(me: &str, friend: &str) -> Result<Vec<LiWithEntry>, rusqlite::Error> {
    let conn = DB.get_connection()?;

    let mut stmt = conn.prepare(
        "
        SELECT
            li.entry_id,
            li.user_id,
            li.amount_cents,
            le.description,
            le.created_at,
            le.kind
        FROM   line_item      li
        JOIN   ledger_entry   le ON le.id = li.entry_id
        WHERE  li.user_id IN (?1, ?2);
        ",
    )?;

    let rows = stmt.query_map(params![me, friend], |row| {
        Ok(LiWithEntry {
            entry_id: row.get(0)?,
            user_id: row.get(1)?,
            amount_cents: row.get(2)?,
            description: row.get(3)?,
            created_at: row.get(4)?,
            kind: row.get(5)?,
        })
    })?;

    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

use std::error::Error;

use rusqlite::params;

use crate::services::database::DB;

use super::model::{LiWithEntry, LineItemInfo, SplitSummary};

pub fn fetch_friend_ledger_from_database(
    me: &str,
    friend: &str,
) -> Result<Vec<LiWithEntry>, rusqlite::Error> {
    let conn = DB.get_connection()?;

    let mut stmt = conn.prepare(
        "
        SELECT
            li.entry_id,
            li.user_id,
            li.amount_cents,
            le.description,
            le.created_at,
            le.kind,
            le.transaction_id,
            le.is_dirty
        FROM   line_item      li
        JOIN   ledger_entry   le ON le.id = li.entry_id
        WHERE  le.is_deleted = 0 
          AND  li.user_id IN (?1, ?2);
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
            transaction_id: row.get(6)?,
            is_dirty: row.get(7)?,
        })
    })?;

    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn fetch_split_summary_from_database(
    entry_id: &str,
) -> Result<SplitSummary, Box<dyn std::error::Error>> {
    let conn = DB.get_connection()?;
    let (description, transaction_id): (Option<String>, Option<usize>) = conn.query_row(
        "SELECT description, transaction_id FROM ledger_entry WHERE id = ?1;",
        params![entry_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;

    let mut stmt = conn.prepare(
        "
        SELECT user_id, amount_cents, paid_cents, owed_cents
        FROM   line_item
        WHERE  entry_id = ?1;
        ",
    )?;

    let item_iter = stmt.query_map(params![entry_id], |row| {
        Ok(LineItemInfo {
            user_id: row.get(0)?,
            amount_cents: row.get(1)?,
            paid_cents: row.get(2)?,
            owed_cents: row.get(3)?,
        })
    })?;

    let mut items = Vec::new();
    for it in item_iter {
        items.push(it?);
    }

    Ok(SplitSummary {
        description,
        items,
        transaction_id,
    })
}

pub fn delete_split_from_database(entry_id: &str)->Result<(), Box<dyn Error>>{
    let conn = DB.get_connection()?;
    conn.execute(
        "UPDATE ledger_entry SET is_deleted = 1, is_dirty = 1 WHERE id = ?1;",
        params![entry_id],
    )?;
    Ok(())
}

use std::error::Error;

use rusqlite::params;

use crate::services::database::DB;

use super::model::LineItemRow;

pub fn get_line_items_for_dirty_ledger_entries_from_database(
) -> Result<Vec<LineItemRow>, Box<dyn Error>> {
    let conn = DB.get_connection()?;

    let mut stmt = conn.prepare(
        r#"
        SELECT
            li.entry_id,
            li.user_id,
            li.amount_cents,
            li.paid_cents,
            li.owed_cents,
            li.updated_at
        FROM   line_item            AS li
        JOIN   ledger_entry         AS le
               ON le.id = li.entry_id
        WHERE  le.is_dirty = 1
        "#,
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(LineItemRow {
            entry_id:     row.get(0)?,
            user_id:      row.get(1)?,
            amount_cents: row.get(2)?,
            paid_cents:   row.get(3)?,
            owed_cents:   row.get(4)?,
            updated_at:   row.get(5)?,
        })
    })?;

    let mut results = Vec::new();
    for li in rows {
        results.push(li?);
    }

    Ok(results)
}

pub fn upsert_line_items_in_database(items: Vec<LineItemRow>) -> Result<(), Box<dyn Error>> {
    let mut conn = DB.get_connection()?;
    let tx = conn.transaction()?;

    let mut stmt = tx.prepare(
        "
        INSERT INTO line_item
            (entry_id, user_id, amount_cents, paid_cents, owed_cents, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        ON CONFLICT(entry_id, user_id) DO UPDATE SET
            amount_cents = excluded.amount_cents,
            paid_cents   = excluded.paid_cents,
            owed_cents   = excluded.owed_cents,
            updated_at   = excluded.updated_at;
        ",
    )?;

    for li in items {
        stmt.execute(params![
            li.entry_id,
            li.user_id,
            li.amount_cents,
            li.paid_cents,
            li.owed_cents,
            li.updated_at
        ])?;
    }
    drop(stmt);
    tx.commit()?;
    Ok(())
}

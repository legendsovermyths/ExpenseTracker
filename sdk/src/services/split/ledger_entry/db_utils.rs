use std::error::Error;

use rusqlite::params;

use crate::services::database::DB;

use super::model::LedgerEntryRow;

pub fn upsert_ledger_entries_in_database(
    entries: Vec<LedgerEntryRow>,
) -> Result<(), Box<dyn Error>> {
    let mut conn = DB.get_connection()?;
    let tx = conn.transaction()?;

    let mut stmt = tx.prepare(
        "
        INSERT INTO ledger_entry
            (id, kind, description, created_by, total_cents, updated_at, transaction_id, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        ON CONFLICT(id) DO UPDATE SET
            kind          = excluded.kind,
            description   = excluded.description,
            created_by    = excluded.created_by,
            total_cents   = excluded.total_cents,
            updated_at    = excluded.updated_at,
            transaction_id= excluded.transaction_id,
            created_at  = excluded.created_at;
        ",
    )?;

    for e in entries {
        stmt.execute(params![
            e.id,
            e.kind,
            e.description,
            e.created_by,
            e.total_cents,
            e.updated_at,
            e.transaction_id,
            e.created_at
        ])?;
    }
    drop(stmt);
    tx.commit()?;
    Ok(())
}

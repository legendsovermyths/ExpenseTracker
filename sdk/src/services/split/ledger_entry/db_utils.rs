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
        r#"
        INSERT INTO ledger_entry
            (id, kind, description, created_by, total_cents, updated_at,
             transaction_id, created_at, is_deleted, is_dirty)
        VALUES
            (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0)
        ON CONFLICT(id) DO UPDATE SET
            kind         = excluded.kind,
            description  = excluded.description,
            created_by   = excluded.created_by,
            total_cents  = excluded.total_cents,
            updated_at   = excluded.updated_at,
            created_at   = excluded.created_at,
            is_deleted   = excluded.is_deleted,
            is_dirty     = 0,
        "#
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
            e.created_at,
            e.is_deleted,
        ])?;
    }

    drop(stmt);
    tx.commit()?;
    Ok(())
}

pub fn get_dirty_ledger_enteries_from_database(
) -> Result<Vec<LedgerEntryRow>, Box<dyn Error>> {
    let conn = DB.get_connection()?;
    let mut stmt = conn.prepare(
        r#"
        SELECT
            id,
            kind,
            description,
            created_by,
            total_cents,
            updated_at,
            transaction_id,
            created_at,
            is_deleted
        FROM ledger_entry
        WHERE is_dirty = 1
        "#,
    )?;

    let dirty_entries_iter = stmt.query_map([], |row| {
        Ok(LedgerEntryRow {
            id:             row.get(0)?,
            kind:           row.get(1)?,
            description:    row.get(2)?,      // Option<String>
            created_by:     row.get(3)?,
            total_cents:    row.get(4)?,
            updated_at:     row.get(5)?,      // String or chrono::DateTime<…>
            transaction_id: row.get(6)?,      // Option<i64 / usize>
            created_at:     row.get(7)?,
            is_deleted:     row.get(8)?,
        })
    })?;

    let mut results = Vec::new();
    for entry in dirty_entries_iter {
        results.push(entry?);
    }

    Ok(results)
}

pub fn add_ledger_entries_in_database(entries: Vec<LedgerEntryRow>) -> Result<(), Box<dyn Error>> {
    let mut conn = DB.get_connection()?;
    let tx = conn.transaction()?;

    let mut stmt = tx.prepare(
        "
        INSERT INTO ledger_entry
            (id, kind, description, created_by, total_cents, updated_at, transaction_id, created_at, is_deleted, is_dirty)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1)
        ON CONFLICT(id) DO UPDATE SET
            kind          = excluded.kind,
            description   = excluded.description,
            created_by    = excluded.created_by,
            total_cents   = excluded.total_cents,
            updated_at    = excluded.updated_at,
            created_at  = excluded.created_at,
            is_deleted = excluded.is_deleted,
            is_dirty = 1;
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
            e.created_at,
            e.is_deleted,
        ])?;
    }
    drop(stmt);
    tx.commit()?;
    Ok(())
}

pub fn link_transaction_to_entry_in_database(
    entry_id: &str,
    transaction_id: usize,
) -> Result<(), Box<dyn std::error::Error>> {
    let conn = DB.get_connection()?;
    conn.execute(
        "
        UPDATE ledger_entry
        SET    transaction_id = ?1,
               updated_at     = datetime('now')
        WHERE  id = ?2;
        ",
        params![transaction_id, entry_id],
    )?;

    Ok(())
}

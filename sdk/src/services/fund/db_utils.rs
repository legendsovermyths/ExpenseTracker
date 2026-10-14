use std::error::Error;

use rusqlite::params;

use crate::services::database::DB;

use super::model::{FundEntryRow, FundRow};

// ---- fund -------------------------------------------------------------------

// Local create/edit path — always marks the row dirty so it gets pushed on
// the next sync. NOT used for rows coming down from Supabase (see
// `upsert_fund_from_sync` below) — mixing the two up would either drop local
// edits (never pushed) or permanently re-dirty synced rows (pushed forever).
pub fn insert_or_update_fund(fund: FundRow) -> Result<(), Box<dyn Error>> {
    let conn = DB.get_connection()?;
    conn.execute(
        "INSERT INTO fund
            (id, name, icon_name, icon_type, is_shared, owner_id, other_participant_id,
             other_participant_name, target_cents, target_date, created_at, updated_at,
             is_deleted, is_dirty)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 1)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            icon_name = excluded.icon_name,
            icon_type = excluded.icon_type,
            is_shared = excluded.is_shared,
            owner_id = excluded.owner_id,
            other_participant_id = excluded.other_participant_id,
            other_participant_name = excluded.other_participant_name,
            target_cents = excluded.target_cents,
            target_date = excluded.target_date,
            updated_at = excluded.updated_at,
            is_deleted = excluded.is_deleted,
            is_dirty = 1;",
        params![
            fund.id,
            fund.name,
            fund.icon_name,
            fund.icon_type,
            fund.is_shared,
            fund.owner_id,
            fund.other_participant_id,
            fund.other_participant_name,
            fund.target_cents,
            fund.target_date,
            fund.created_at,
            fund.updated_at,
            fund.is_deleted,
        ],
    )?;
    Ok(())
}

// Sync-pull path — rows arriving from Supabase are already clean.
pub fn upsert_fund_from_sync(fund: FundRow) -> Result<(), Box<dyn Error>> {
    let conn = DB.get_connection()?;
    conn.execute(
        "INSERT INTO fund
            (id, name, icon_name, icon_type, is_shared, owner_id, other_participant_id,
             other_participant_name, target_cents, target_date, created_at, updated_at,
             is_deleted, is_dirty)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 0)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            icon_name = excluded.icon_name,
            icon_type = excluded.icon_type,
            is_shared = excluded.is_shared,
            owner_id = excluded.owner_id,
            other_participant_id = excluded.other_participant_id,
            other_participant_name = excluded.other_participant_name,
            target_cents = excluded.target_cents,
            target_date = excluded.target_date,
            updated_at = excluded.updated_at,
            is_deleted = excluded.is_deleted,
            is_dirty = 0;",
        params![
            fund.id,
            fund.name,
            fund.icon_name,
            fund.icon_type,
            fund.is_shared,
            fund.owner_id,
            fund.other_participant_id,
            fund.other_participant_name,
            fund.target_cents,
            fund.target_date,
            fund.created_at,
            fund.updated_at,
            fund.is_deleted,
        ],
    )?;
    Ok(())
}

fn map_fund_row(row: &rusqlite::Row) -> rusqlite::Result<FundRow> {
    Ok(FundRow {
        id: row.get(0)?,
        name: row.get(1)?,
        icon_name: row.get(2)?,
        icon_type: row.get(3)?,
        is_shared: row.get(4)?,
        owner_id: row.get(5)?,
        other_participant_id: row.get(6)?,
        other_participant_name: row.get(7)?,
        target_cents: row.get(8)?,
        target_date: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
        is_deleted: row.get(12)?,
    })
}

const FUND_COLUMNS: &str = "id, name, icon_name, icon_type, is_shared, owner_id, other_participant_id,
    other_participant_name, target_cents, target_date, created_at, updated_at, is_deleted";

pub fn get_funds_for_user_from_database(user_id: &str) -> Result<Vec<FundRow>, Box<dyn Error>> {
    let conn = DB.get_connection()?;
    let query = format!(
        "SELECT {FUND_COLUMNS} FROM fund
         WHERE (owner_id = ?1 OR other_participant_id = ?1) AND is_deleted = 0
         ORDER BY updated_at DESC"
    );
    let mut stmt = conn.prepare(&query)?;
    let rows = stmt.query_map(params![user_id], map_fund_row)?;
    let mut results = Vec::new();
    for r in rows {
        results.push(r?);
    }
    Ok(results)
}

pub fn get_fund_from_database(fund_id: &str) -> Result<FundRow, Box<dyn Error>> {
    let conn = DB.get_connection()?;
    let query = format!("SELECT {FUND_COLUMNS} FROM fund WHERE id = ?1");
    let fund = conn.query_row(&query, params![fund_id], map_fund_row)?;
    Ok(fund)
}

pub fn soft_delete_fund_in_database(fund_id: &str, updated_at: &str) -> Result<(), Box<dyn Error>> {
    let conn = DB.get_connection()?;
    conn.execute(
        "UPDATE fund SET is_deleted = 1, is_dirty = 1, updated_at = ?2 WHERE id = ?1",
        params![fund_id, updated_at],
    )?;
    Ok(())
}

pub fn get_dirty_funds_from_database() -> Result<Vec<FundRow>, Box<dyn Error>> {
    let conn = DB.get_connection()?;
    let query = format!("SELECT {FUND_COLUMNS} FROM fund WHERE is_dirty = 1");
    let mut stmt = conn.prepare(&query)?;
    let rows = stmt.query_map([], map_fund_row)?;
    let mut results = Vec::new();
    for r in rows {
        results.push(r?);
    }
    Ok(results)
}

// ---- fund_entry ---------------------------------------------------------------

pub fn insert_or_update_fund_entry(entry: FundEntryRow) -> Result<(), Box<dyn Error>> {
    let conn = DB.get_connection()?;
    conn.execute(
        "INSERT INTO fund_entry
            (id, fund_id, contributor_id, amount_cents, direction, note,
             linked_transaction_id, created_at, updated_at, is_deleted, is_dirty)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1)
         ON CONFLICT(id) DO UPDATE SET
            amount_cents = excluded.amount_cents,
            direction = excluded.direction,
            note = excluded.note,
            linked_transaction_id = excluded.linked_transaction_id,
            updated_at = excluded.updated_at,
            is_deleted = excluded.is_deleted,
            is_dirty = 1;",
        params![
            entry.id,
            entry.fund_id,
            entry.contributor_id,
            entry.amount_cents,
            entry.direction,
            entry.note,
            entry.linked_transaction_id,
            entry.created_at,
            entry.updated_at,
            entry.is_deleted,
        ],
    )?;
    Ok(())
}

pub fn upsert_fund_entry_from_sync(entry: FundEntryRow) -> Result<(), Box<dyn Error>> {
    let conn = DB.get_connection()?;
    conn.execute(
        "INSERT INTO fund_entry
            (id, fund_id, contributor_id, amount_cents, direction, note,
             linked_transaction_id, created_at, updated_at, is_deleted, is_dirty)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 0)
         ON CONFLICT(id) DO UPDATE SET
            amount_cents = excluded.amount_cents,
            direction = excluded.direction,
            note = excluded.note,
            linked_transaction_id = excluded.linked_transaction_id,
            updated_at = excluded.updated_at,
            is_deleted = excluded.is_deleted,
            is_dirty = 0;",
        params![
            entry.id,
            entry.fund_id,
            entry.contributor_id,
            entry.amount_cents,
            entry.direction,
            entry.note,
            entry.linked_transaction_id,
            entry.created_at,
            entry.updated_at,
            entry.is_deleted,
        ],
    )?;
    Ok(())
}

fn map_fund_entry_row(row: &rusqlite::Row) -> rusqlite::Result<FundEntryRow> {
    Ok(FundEntryRow {
        id: row.get(0)?,
        fund_id: row.get(1)?,
        contributor_id: row.get(2)?,
        amount_cents: row.get(3)?,
        direction: row.get(4)?,
        note: row.get(5)?,
        linked_transaction_id: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
        is_deleted: row.get(9)?,
    })
}

const FUND_ENTRY_COLUMNS: &str = "id, fund_id, contributor_id, amount_cents, direction, note,
    linked_transaction_id, created_at, updated_at, is_deleted";

pub fn get_fund_entries_from_database(fund_id: &str) -> Result<Vec<FundEntryRow>, Box<dyn Error>> {
    let conn = DB.get_connection()?;
    let query = format!(
        "SELECT {FUND_ENTRY_COLUMNS} FROM fund_entry
         WHERE fund_id = ?1 AND is_deleted = 0
         ORDER BY created_at DESC"
    );
    let mut stmt = conn.prepare(&query)?;
    let rows = stmt.query_map(params![fund_id], map_fund_entry_row)?;
    let mut results = Vec::new();
    for r in rows {
        results.push(r?);
    }
    Ok(results)
}

pub fn get_fund_total_contributed_from_database(fund_id: &str) -> Result<i64, Box<dyn Error>> {
    let conn = DB.get_connection()?;
    let total: i64 = conn.query_row(
        "SELECT COALESCE(SUM(CASE WHEN direction = 'CONTRIBUTION' THEN amount_cents ELSE -amount_cents END), 0)
         FROM fund_entry WHERE fund_id = ?1 AND is_deleted = 0",
        params![fund_id],
        |row| row.get(0),
    )?;
    Ok(total)
}

pub fn soft_delete_fund_entry_in_database(
    entry_id: &str,
    updated_at: &str,
) -> Result<(), Box<dyn Error>> {
    let conn = DB.get_connection()?;
    conn.execute(
        "UPDATE fund_entry SET is_deleted = 1, is_dirty = 1, updated_at = ?2 WHERE id = ?1",
        params![entry_id, updated_at],
    )?;
    Ok(())
}

pub fn get_dirty_fund_entries_from_database() -> Result<Vec<FundEntryRow>, Box<dyn Error>> {
    let conn = DB.get_connection()?;
    let query = format!("SELECT {FUND_ENTRY_COLUMNS} FROM fund_entry WHERE is_dirty = 1");
    let mut stmt = conn.prepare(&query)?;
    let rows = stmt.query_map([], map_fund_entry_row)?;
    let mut results = Vec::new();
    for r in rows {
        results.push(r?);
    }
    Ok(results)
}

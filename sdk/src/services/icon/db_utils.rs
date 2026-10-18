use std::error::Error;

use rusqlite::{params, Connection};

use crate::services::database::DB;

use super::model::{IconRow, PushedIcon};

const COLUMNS: &str = "id, owner_id, path, prompt, created_at, updated_at, is_deleted";

/// Same rule as the `icon_path_shape` CHECK in Supabase, so a row that
/// saves locally will also sync, and nothing else ever reaches the renderer.
pub fn is_valid_path(path: &str) -> bool {
    !path.is_empty()
        && path.len() <= 16384
        && path.starts_with(['M', 'm'])
        && path.chars().all(|c| "MmLlHhVvCcSsQqTtZz0123456789 .,eE+-".contains(c))
}

pub fn is_valid_prompt(prompt: &Option<String>) -> bool {
    prompt.as_ref().map_or(true, |p| p.chars().count() <= 60)
}

fn map_row(row: &rusqlite::Row) -> rusqlite::Result<IconRow> {
    Ok(IconRow {
        id: row.get(0)?,
        owner_id: row.get(1)?,
        path: row.get(2)?,
        prompt: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
        is_deleted: row.get(6)?,
    })
}

pub fn get_icon(conn: &Connection, id: &str) -> rusqlite::Result<Option<IconRow>> {
    let mut stmt = conn.prepare(&format!("SELECT {COLUMNS} FROM custom_icons WHERE id = ?1"))?;
    let mut rows = stmt.query_map(params![id], map_row)?;
    rows.next().transpose()
}

/// A new local icon. Icons are immutable, so saving an id that already
/// exists keeps the stored row untouched (safe for retries).
pub fn insert_icon_in_database(icon: &IconRow) -> Result<IconRow, Box<dyn Error>> {
    let conn = DB.get_connection()?;
    conn.execute(
        "INSERT INTO custom_icons (id, owner_id, path, prompt, created_at, updated_at, is_deleted, is_dirty)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1)
         ON CONFLICT(id) DO NOTHING;",
        params![
            icon.id,
            icon.owner_id,
            icon.path,
            icon.prompt,
            icon.created_at,
            icon.updated_at.clone().unwrap_or_else(|| icon.created_at.clone()),
            icon.is_deleted
        ],
    )?;
    Ok(get_icon(&conn, &icon.id)?.ok_or("icon not saved")?)
}

pub fn soft_delete_icon_in_database(id: &str, updated_at: &str) -> Result<(), Box<dyn Error>> {
    let conn = DB.get_connection()?;
    conn.execute(
        "UPDATE custom_icons SET is_deleted = 1, is_dirty = 1, updated_at = ?2 WHERE id = ?1",
        params![id, updated_at],
    )?;
    Ok(())
}

pub fn get_icons_from_database() -> Result<Vec<IconRow>, Box<dyn Error>> {
    let conn = DB.get_connection()?;
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLUMNS} FROM custom_icons ORDER BY created_at DESC, id"
    ))?;
    let rows = stmt.query_map([], map_row)?.collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

pub fn get_dirty_icons_from_database() -> Result<Vec<IconRow>, Box<dyn Error>> {
    let conn = DB.get_connection()?;
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLUMNS} FROM custom_icons WHERE is_dirty = 1 ORDER BY created_at"
    ))?;
    let rows = stmt.query_map([], map_row)?.collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

/// Apply rows pulled from Supabase and clear the dirty flag on pushed ones.
/// A local edit that hasn't been pushed yet wins over the server copy.
/// Malformed rows are skipped rather than failing the whole sync.
pub fn sync_icons_in_database(icons: &[IconRow], pushed: &[PushedIcon]) -> Result<(), Box<dyn Error>> {
    let mut conn = DB.get_connection()?;
    let tx = conn.transaction()?;
    for p in pushed {
        tx.execute(
            "UPDATE custom_icons SET is_dirty = 0 WHERE id = ?1 AND updated_at IS ?2",
            params![p.id, p.updated_at],
        )?;
    }
    for i in icons {
        if !is_valid_path(&i.path) || !is_valid_prompt(&i.prompt) {
            continue;
        }
        tx.execute(
            "INSERT INTO custom_icons (id, owner_id, path, prompt, created_at, updated_at, is_deleted, is_dirty)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0)
             ON CONFLICT(id) DO UPDATE SET
                owner_id = excluded.owner_id,
                path = excluded.path,
                prompt = excluded.prompt,
                created_at = excluded.created_at,
                updated_at = excluded.updated_at,
                is_deleted = excluded.is_deleted
             WHERE custom_icons.is_dirty = 0;",
            params![i.id, i.owner_id, i.path, i.prompt, i.created_at, i.updated_at, i.is_deleted],
        )?;
    }
    tx.commit()?;
    Ok(())
}

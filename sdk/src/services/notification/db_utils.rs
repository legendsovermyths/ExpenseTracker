use std::error::Error;

use rusqlite::params;

use crate::services::database::DB;

use super::model::NotificationRow;

pub fn upsert_notifications_in_database(rows: Vec<NotificationRow>) -> Result<(), Box<dyn Error>> {
    let mut conn = DB.get_connection()?;
    let tx = conn.transaction()?;
    {
        let mut stmt = tx.prepare(
            "INSERT INTO notifications (id, user_id, type, actor_id, payload, created_at, read_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(id) DO UPDATE SET
                read_at = excluded.read_at;",
        )?;
        for n in rows {
            stmt.execute(params![
                n.id,
                n.user_id,
                n.kind,
                n.actor_id,
                n.payload,
                n.created_at,
                n.read_at
            ])?;
        }
    }
    tx.commit()?;
    Ok(())
}

pub fn get_notifications_from_database(
    limit: Option<i64>,
) -> Result<Vec<NotificationRow>, Box<dyn Error>> {
    let conn = DB.get_connection()?;
    let mut query = String::from(
        "SELECT id, user_id, type, actor_id, payload, created_at, read_at
         FROM notifications
         ORDER BY created_at DESC",
    );
    if let Some(limit) = limit {
        query.push_str(&format!(" LIMIT {}", limit));
    }

    let mut stmt = conn.prepare(&query)?;
    let rows = stmt.query_map([], |row| {
        Ok(NotificationRow {
            id: row.get(0)?,
            user_id: row.get(1)?,
            kind: row.get(2)?,
            actor_id: row.get(3)?,
            payload: row.get(4)?,
            created_at: row.get(5)?,
            read_at: row.get(6)?,
        })
    })?;

    let mut results = Vec::new();
    for r in rows {
        results.push(r?);
    }
    Ok(results)
}

pub fn mark_notification_read_in_database(id: &str, read_at: &str) -> Result<(), Box<dyn Error>> {
    let conn = DB.get_connection()?;
    conn.execute(
        "UPDATE notifications SET read_at = ?1 WHERE id = ?2",
        params![read_at, id],
    )?;
    Ok(())
}

pub fn get_unread_notification_count_from_database() -> Result<i64, Box<dyn Error>> {
    let conn = DB.get_connection()?;
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM notifications WHERE read_at IS NULL",
        [],
        |row| row.get(0),
    )?;
    Ok(count)
}

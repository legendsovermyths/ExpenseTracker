use rusqlite::{params, Result};

use crate::services::database::DB;

use super::model::Friend;

pub fn upsert_friend_in_database(friend: Friend) -> Result<Friend> {
    let conn = DB.get_connection()?;
    conn.execute(
        "INSERT INTO friends (friend_id, friend_name, added_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(friend_id) DO UPDATE SET friend_name = excluded.friend_name;",
        params![friend.id, friend.name, friend.added_at],
    )?;
    conn.query_row(
        "SELECT friend_id, friend_name, added_at FROM friends WHERE friend_id = ?1",
        params![friend.id],
        |row| {
            Ok(Friend {
                id: row.get(0)?,
                name: row.get(1)?,
                added_at: row.get(2)?,
            })
        },
    )
}

pub fn delete_friend_from_database(friend_id: &str) -> Result<()> {
    let conn = DB.get_connection()?;
    conn.execute("DELETE FROM friends WHERE friend_id = ?1", params![friend_id])?;
    Ok(())
}

pub fn get_all_friends_from_database() -> Result<Vec<Friend>> {
    let conn = DB.get_connection()?;
    let mut stmt = conn.prepare(
        "SELECT friend_id, friend_name, added_at FROM friends ORDER BY friend_name COLLATE NOCASE",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Friend {
            id: row.get(0)?,
            name: row.get(1)?,
            added_at: row.get(2)?,
        })
    })?;
    rows.collect()
}

use crate::services::appconstants::model::Appconstant;
use crate::services::database::DB;
use rusqlite::{params, Result};

pub fn add_appconstant_to_database(appconstant: Appconstant) -> Result<Appconstant> {
    let conn = DB.get_connection()?;
    conn.execute(
        "INSERT INTO appconstants (key, value) VALUES (?1, ?2);",
        params![appconstant.key, appconstant.value],
    )?;
    let last_id = conn.last_insert_rowid() as u32;
    Ok(Appconstant {
        id: Some(last_id),
        ..appconstant
    })
}

pub fn get_all_appconstants_from_database() -> Result<Vec<Appconstant>> {
    let conn = DB.get_connection()?;
    let mut stmt = conn.prepare("SELECT id, key, value FROM appconstants")?;

    let rows = stmt.query_map([], |row| {
        Ok(Appconstant {
            id: Some(row.get(0)?),
            key: row.get(1)?,
            value: row.get(2)?,
        })
    })?;

    let mut appconstants = Vec::new();
    for appconstant in rows {
        appconstants.push(appconstant?);
    }
    Ok(appconstants)
}

pub fn update_appconstant_in_database(appconstant: Appconstant) -> Result<Appconstant> {
    let conn = DB.get_connection()?;
    conn.execute(
        "UPDATE appconstants SET value = ?1 WHERE id = ?2;",
        params![appconstant.value, appconstant.id],
    )?;
    Ok(appconstant)
}

pub fn delete_appconstant_from_database(id: u32) -> Result<()> {
    let conn = DB.get_connection()?;
    conn.execute("DELETE FROM appconstants WHERE id = ?1;", params![id])?;
    Ok(())
}

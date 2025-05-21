use std::error::Error;

use rusqlite::params;

use crate::services::database::DB;

use super::model::UserBalance;

pub fn update_balances_in_db(updated_list: Vec<UserBalance>) -> Result<(), Box<dyn Error>> {
    let mut conn = DB.get_connection()?;

    let tx = conn.transaction()?;
    tx.execute("DELETE FROM balance_overview;", [])?;
    let mut stmt = tx.prepare(
        "INSERT INTO balance_overview
           (friend_id, friend_name, net_cents)
         VALUES (?1, ?2, ?3);",
    )?;

    for ub in updated_list {
        stmt.execute(params![ub.id, ub.name, ub.net_cents])?;
    }
    drop(stmt);
    tx.commit()?;
    Ok(())
}

pub fn get_all_balances_from_db() -> Result<Vec<UserBalance>, Box<dyn Error>> {
    let conn = DB.get_connection()?;

    let mut stmt = conn.prepare(
        "SELECT friend_id, friend_name, net_cents
         FROM   balance_overview
         ORDER  BY ABS(net_cents) DESC;",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(UserBalance {
            id: row.get(0)?,
            name: row.get(1)?,
            net_cents: row.get(2)?,
        })
    })?;

    let mut out = Vec::new();
    for ub in rows {
        out.push(ub?);
    }

    Ok(out)
}

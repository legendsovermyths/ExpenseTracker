
use rusqlite::{params, Result};

use crate::services::database::DB;

use super::model::Account;

pub fn add_account_to_database(account: Account) -> Result<Account> {
    let conn = DB.get_connection()?;
    conn.execute(
        "INSERT INTO accounts (amount, name, is_credit, date_time, color_theme, due_date, frequency) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7);",
        params![
            account.amount,
            account.name,
            account.is_credit,
            account.date_time,
            account.theme,
            account.due_date,
            account.frequency
        ],
    )?;
    let last_id = conn.last_insert_rowid() as u32;
    Ok(Account {
        id: Some(last_id),
        ..account
    })
}

pub fn get_account_from_database(id: u32) -> Result<Account> {
    let conn = DB.get_connection()?;
    let mut stmt = conn.prepare(
        "SELECT id, amount, name, is_credit, date_time, color_theme, due_date, frequency 
         FROM accounts 
         WHERE id = ?1",
    )?;
    let mut rows = stmt.query(params![id])?;
    if let Some(row) = rows.next()? {
        Ok(Account {
            id: Some(row.get(0)?),
            amount: row.get(1)?,
            name: row.get(2)?,
            is_credit: row.get(3)?,
            date_time: row.get(4)?,
            theme: row.get(5)?,
            due_date: row.get(6)?,
            frequency: row.get(7)?,
        })
    } else {
        Err(rusqlite::Error::QueryReturnedNoRows)
    }
}

pub fn update_account_in_database(account: Account) -> Result<Account> {
    let conn = DB.get_connection()?;
    conn.execute(
        "UPDATE accounts 
         SET amount = ?1, name = ?2, is_credit = ?3, date_time = ?4, 
             color_theme = ?5, due_date = ?6, frequency = ?7 
         WHERE id = ?8",
        params![
            account.amount,
            account.name,
            account.is_credit,
            account.date_time,
            account.theme,
            account.due_date,
            account.frequency,
            account.id
        ],
    )?;
    Ok(account)
}

pub fn delete_account_from_database(id: u32) -> Result<()> {
    let conn = DB.get_connection()?;
    conn.execute("UPDATE accounts SET is_deleted = 1 WHERE id = ?1", params![id])?;
    Ok(())
}

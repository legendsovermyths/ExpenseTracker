use rusqlite::{params, Result};

use crate::services::database::{Database, DB};

use super::model::Transaction;

pub fn get_transaction_from_database(id: u32) -> Result<Transaction> {
    let conn = DB.get_connection()?;
    let mut stmt = conn.prepare(
        "SELECT id, description, amount, account_id, category_id, subcategory_id, date_time, is_credit 
         FROM transactions 
         WHERE id = ?1",
    )?;
    let mut rows = stmt.query(params![id])?;
    if let Some(row) = rows.next()? {
        Ok(Transaction {
            id: Some(row.get(0)?),
            description: row.get(1)?,
            amount: row.get(2)?,
            account_id: row.get(3)?,
            category_id: row.get(4)?,
            subcategory_id: row.get(5)?,
            date_time: row.get(6)?,
            is_credit: row.get(7)?,
        })
    } else {
        Err(rusqlite::Error::QueryReturnedNoRows)
    }
}

pub fn update_transaction_in_database(transaction: Transaction) -> Result<Transaction> {
    let conn = DB.get_connection()?;
    conn.execute(
        "UPDATE transactions 
         SET description = ?1, amount = ?2, date_time = ?3, account_id = ?4, 
             category_id = ?5, subcategory_id = ?6, is_credit = ?7 
         WHERE id = ?8",
        params![
            transaction.description,
            transaction.amount,
            transaction.date_time,
            transaction.account_id,
            transaction.category_id,
            transaction.subcategory_id,
            transaction.is_credit,
            transaction.id
        ],
    )?;
    Ok(transaction)
}

pub fn delete_transaction_from_database(id: u32) -> Result<()> {
    let conn = DB.get_connection()?;
    conn.execute("DELETE FROM transactions WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn add_transaction_to_database(transaction: Transaction) -> Result<Transaction> {
    let conn = Database::new()?;
    let conn = conn.connection.lock().unwrap();
    conn.execute("INSERT INTO transactions (description, amount, date_time, account_id, category_id, subcategory_id, is_credit) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7);",params![transaction.description, transaction.amount,transaction.date_time, transaction.account_id, transaction.category_id, transaction.subcategory_id, transaction.is_credit])?;
    let last_id = conn.last_insert_rowid() as u32;
    Ok(Transaction {
        id: Some(last_id),
        ..transaction
    })
}

pub fn get_all_transaction_from_database() -> Result<Vec<Transaction>> {
    let conn = DB.get_connection()?;
    let mut stmt = conn.prepare(
        "SELECT id, description, amount, account_id, category_id, subcategory_id, date_time, is_credit 
         FROM transactions",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Transaction {
            id: Some(row.get(0)?),
            description: row.get(1)?,
            amount: row.get(2)?,
            account_id: row.get(3)?,
            category_id: row.get(4)?,
            subcategory_id: row.get(5)?,
            date_time: row.get(6)?,
            is_credit: row.get(7)?,
        })
    })?;

    let mut transactions = Vec::new();
    for transaction in rows {
        transactions.push(transaction?);
    }
    Ok(transactions)
}

use crate::services::attachment::{db_utils::delete_attachments_for_owner, model::OWNER_TRANSACTION};
use rusqlite::{params, Result};

use crate::services::database::{Database, DB};

use super::model::{GetTransactionsPayload, Transaction};

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
    delete_attachments_for_owner(&conn, OWNER_TRANSACTION, &id.to_string())?;
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

pub fn get_transactions_since_from_database(
    filters: GetTransactionsPayload,
) -> Result<Vec<Transaction>> {
    let conn = DB.get_connection()?;

    let mut clauses: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();
    if let Some(start_date) = &filters.start_date {
        clauses.push("t.date_time >= ?".to_string());
        bind_values.push(start_date.clone());
    }
    if let Some(end_date) = &filters.end_date {
        clauses.push("t.date_time <= ?".to_string());
        bind_values.push(end_date.clone());
    }
    // Every word must match somewhere (description, category, subcategory,
    // account, or amount), in any order and regardless of case.
    for token in search_tokens(filters.search_text.as_deref().unwrap_or("")) {
        clauses.push(SEARCH_CLAUSE.to_string());
        let pattern = format!("%{}%", escape_like(&token));
        for _ in 0..SEARCH_BINDS {
            bind_values.push(pattern.clone());
        }
    }

    let mut query = String::from(SEARCH_SELECT);
    if !clauses.is_empty() {
        query.push_str(" WHERE ");
        query.push_str(&clauses.join(" AND "));
    }
    query.push_str(" ORDER BY t.date_time DESC");
    if let Some(limit) = filters.limit {
        query.push_str(&format!(" LIMIT {}", limit));
    }

    let mut stmt = conn.prepare(&query)?;
    let params: Vec<&dyn rusqlite::ToSql> =
        bind_values.iter().map(|v| v as &dyn rusqlite::ToSql).collect();
    let rows = stmt.query_map(params.as_slice(), |row| {
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

pub fn get_transaction_count_from_database() -> Result<i64> {
    let conn = DB.get_connection()?;
    conn.query_row("SELECT COUNT(*) FROM transactions", [], |row| row.get(0))
}

// The joins are only needed for search, but are cheap (indexed FKs).
const SEARCH_SELECT: &str =
    "SELECT t.id, t.description, t.amount, t.account_id, t.category_id, t.subcategory_id, t.date_time, t.is_credit
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN categories sc ON sc.id = t.subcategory_id
     LEFT JOIN accounts a ON a.id = t.account_id";

const SEARCH_CLAUSE: &str = "(LOWER(t.description) LIKE ? ESCAPE '\\' \
     OR LOWER(c.name) LIKE ? ESCAPE '\\' \
     OR LOWER(sc.name) LIKE ? ESCAPE '\\' \
     OR LOWER(a.name) LIKE ? ESCAPE '\\' \
     OR CAST(t.amount AS TEXT) LIKE ? ESCAPE '\\' \
     OR printf('%.2f', t.amount) LIKE ? ESCAPE '\\')";
const SEARCH_BINDS: usize = 6;

const CURRENCY_SYMBOLS: [char; 12] = ['₹', '$', '€', '£', '¥', '₩', '฿', '₱', '৳', '₦', '₽', '₺'];

/// Splits a search query into lowercase words, dropping currency symbols and
/// thousands separators so "₹1,200" or "$1,200" finds 1200.
fn search_tokens(raw: &str) -> Vec<String> {
    raw.to_lowercase()
        .replace(',', "")
        .replace(CURRENCY_SYMBOLS, " ")
        .split_whitespace()
        .map(str::to_string)
        .collect()
}

/// Escapes LIKE wildcards so a literal `%` or `_` in the query isn't a wildcard.
fn escape_like(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        if matches!(ch, '%' | '_' | '\\') {
            out.push('\\');
        }
        out.push(ch);
    }
    out
}

#[cfg(test)]
mod search_tests {
    use super::*;

    #[test]
    fn tokens_trim_lowercase_and_strip_currency() {
        assert_eq!(search_tokens("  Pizza  Dominos "), vec!["pizza", "dominos"]);
        assert_eq!(search_tokens("₹1,200"), vec!["1200"]);
        assert_eq!(search_tokens("$1,200"), vec!["1200"]);
        assert_eq!(search_tokens("€ 45"), vec!["45"]);
        assert!(search_tokens("   ").is_empty());
    }

    fn run(conn: &rusqlite::Connection, q: &str) -> Vec<u32> {
        let mut sql = String::from(SEARCH_SELECT);
        let mut binds: Vec<String> = Vec::new();
        let toks = search_tokens(q);
        if !toks.is_empty() {
            sql.push_str(" WHERE ");
            sql.push_str(&vec![SEARCH_CLAUSE; toks.len()].join(" AND "));
        }
        for t in toks {
            let p = format!("%{}%", escape_like(&t));
            for _ in 0..SEARCH_BINDS {
                binds.push(p.clone());
            }
        }
        sql.push_str(" ORDER BY t.id");
        let mut stmt = conn.prepare(&sql).unwrap();
        let params: Vec<&dyn rusqlite::ToSql> = binds.iter().map(|v| v as &dyn rusqlite::ToSql).collect();
        stmt.query_map(params.as_slice(), |r| r.get::<_, u32>(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect()
    }

    #[test]
    fn search_matches_any_field_any_order_any_case() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT);
             CREATE TABLE accounts (id INTEGER PRIMARY KEY, name TEXT);
             CREATE TABLE transactions (id INTEGER PRIMARY KEY, description TEXT, amount REAL,
               account_id INTEGER, category_id INTEGER, subcategory_id INTEGER, date_time TEXT, is_credit INTEGER);
             INSERT INTO categories VALUES (1, 'Food'), (2, 'Dining Out');
             INSERT INTO accounts VALUES (1, 'HDFC');
             INSERT INTO transactions VALUES (1, 'Pizza from Dominos', 1200.0, 1, 1, 2, '2026-10-01', 0);
             INSERT INTO transactions VALUES (2, 'Uber ride', 211.5, 1, 1, NULL, '2026-10-02', 0);
             INSERT INTO transactions VALUES (3, '50% off sale', 99.0, 1, 1, NULL, '2026-10-03', 0);",
        )
        .unwrap();
        assert_eq!(run(&conn, "PIZZA"), vec![1]);
        assert_eq!(run(&conn, "dominos pizza "), vec![1]);
        assert_eq!(run(&conn, "dining"), vec![1]);
        assert_eq!(run(&conn, "hdfc uber"), vec![2]);
        assert_eq!(run(&conn, "₹1,200"), vec![1]);
        assert_eq!(run(&conn, "211.50"), vec![2]);
        assert_eq!(run(&conn, "50%"), vec![3]);
        assert_eq!(run(&conn, "pizza uber"), Vec::<u32>::new());
    }

    #[test]
    fn escapes_like_wildcards() {
        assert_eq!(escape_like("50%_off\\"), "50\\%\\_off\\\\");
    }
}

use once_cell::sync::Lazy;
use rusqlite::{Connection, Result};
use std::env;
use std::sync::Mutex;

pub struct Database {
    pub connection: Mutex<Connection>,
}

impl Database {
    pub fn new() -> Result<Self> {
        let mut db_path = env::var("HOME").unwrap_or_else(|_| ".".to_string());
        db_path.push_str("/Documents/expensify.db");
        let conn = Connection::open(db_path)?;
        let db = Database {
            connection: Mutex::new(conn),
        };
        let connection = db.get_connection()?;
        connection.execute(
            "CREATE TABLE IF NOT EXISTS appconstants(
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
            key TEXT,
            value TEXT
            );",
            [],
        )?;

        connection.execute(
            "CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
            name TEXT,
            icon_name TEXT,
            icon_type TEXT,
            is_subcategory INTEGER,
            parent_category INTEGER REFERENCES categories(id),
            is_deleted INTEGER DEFAULT 0
            );",
            [],
        )?;
        connection.execute(
            "
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                name TEXT,
                amount INTEGER,
                is_credit INTEGER DEFAULT 0,
                date_time TEXT,
                theme TEXT,
                due_date DATE,
                frequency TEXT,
                is_deleted INTEGER DEFAULT 0
            )",
            [],
        )?;
        connection.execute(
            "
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                description TEXT NOT NULL,
                amount REAL NOT NULL,
                date_time TEXT NOT NULL,
                is_credit INTEGER NOT NULL,
                account_id INTEGER NOT NULL,
                category_id INTEGER NOT NULL,
                subcategory_id INTEGER NULL,
                FOREIGN KEY(account_id) REFERENCES accounts(id),
                FOREIGN KEY(category_id) REFERENCES categories(id)
            );
            ",
            [],
        )?;
        drop(connection);
        Ok(db)
    }
    pub fn get_connection(&self) -> Result<std::sync::MutexGuard<Connection>> {
        self.connection
            .lock()
            .map_err(|_| rusqlite::Error::InvalidQuery)
    }
}

pub static DB: Lazy<Database> =
    Lazy::new(|| Database::new().expect("failed to initialize database"));

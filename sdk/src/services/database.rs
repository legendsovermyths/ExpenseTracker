use std::error::Error;

use sqlite::Connection;

pub struct Database {
    connection: Connection,
}

impl Database {
    pub fn new(db_path: &str) -> Result<Database, Box<dyn Error>> {
        let connection = Connection::open(db_path)?;
        connection.execute(
            "CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
            name TEXT,
            icon_name TEXT,
            icon_type TEXT,
            is_subcategory INTEGER,
            parent_category INTEGER REFERENCES categories(id),
            deleted INTEGER DEFAULT 0
            )",
        )?;
        connection.execute(
            "
            CREATE TABLE IF NOT EXISTS banks (
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                name TEXT UNIQUE,
                amount INTEGER,
                is_credit INTEGER DEFAULT 0,
                date_time TEXT,
                color_theme TEXT,
                due_date DATE,
                frequency TEXT,
                is_deleted INTEGER DEFAULT 0,
            )",
        )?;
        connection.execute(
            "
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                description TEXT NOT NULL,
                amount REAL NOT NULL,
                date_time TEXT NOT NULL,
                bank_id INTEGER NOT NULL,
                category_id INTEGER NOT NULL,
                subcategory_id INTEGET NULL,
                FOREIGN KEY(bank_id) REFERENCES banks(id),
                FOREIGN KEY(category_id) REFERENCES categories(id)
            );
            ",
        )?;

        Ok(Self { connection })
    }

    pub fn get_connection(&self) -> &Connection {
        &self.connection
    }
}

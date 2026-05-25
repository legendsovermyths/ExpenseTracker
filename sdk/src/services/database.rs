use chrono::Utc;
use once_cell::sync::Lazy;
use rusqlite::{params, Connection, Result};
use std::error::Error;
use std::fs::File;
use std::io::{Cursor, Write};
use std::sync::Mutex;
use std::{env, fs};
use zip::write::{ExtendedFileOptions, FileOptions};
use zip::{CompressionMethod, ZipArchive, ZipWriter};

use super::appconstants::defaults::DEFAULT_APP_CONSTANTS;

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
             key TEXT UNIQUE,
             value TEXT
             );",
            [],
        )?;
        for (key, value) in DEFAULT_APP_CONSTANTS {
            let exists: Result<String> = connection.query_row(
                "SELECT key FROM appconstants WHERE key = ?1",
                params![key],
                |row| row.get(0),
            );

            if exists.is_err() {
                connection.execute(
                    "INSERT INTO appconstants (key, value) VALUES (?1, ?2);",
                    params![key, value],
                )?;
            }
        }
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
        connection.execute(
            "CREATE TABLE IF NOT EXISTS balance_overview (
                            friend_id    TEXT PRIMARY KEY,
                            friend_name  TEXT NOT NULL,
                            net_cents    BIGINT NOT NULL
                            );",
            [],
        )?;
        connection.execute(
            "
            CREATE TABLE IF NOT EXISTS ledger_entry (
            id            TEXT PRIMARY KEY,
            kind          TEXT NOT NULL,    
            description   TEXT,
            created_by    TEXT,
            created_at    TEXT,
            total_cents   BIGINT,
            updated_at    TEXT,              
            transaction_id INTEGER
            REFERENCES transactions(id)       
            );
        ",
            [],
        )?;
        connection.execute(
            "
            CREATE TABLE IF NOT EXISTS line_item (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                entry_id      TEXT NOT NULL REFERENCES ledger_entry(id) ON DELETE CASCADE,
                user_id       TEXT NOT NULL,
                amount_cents  BIGINT NOT NULL,     
                paid_cents    BIGINT NOT NULL,
                owed_cents    BIGINT NOT NULL,
                updated_at    TEXT
            );
            ",
            [],
        )?;
        connection.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS li_unique
       ON line_item(entry_id, user_id);",
            [],
        )?;
        connection.execute(
            "CREATE TABLE IF NOT EXISTS category_budgets (
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                category_id INTEGER UNIQUE NOT NULL,
                amount REAL NOT NULL,
                FOREIGN KEY(category_id) REFERENCES categories(id)
            )",
            [],
        )?;
        connection.execute(
            "CREATE TABLE IF NOT EXISTS image_parse_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                image_hash TEXT NOT NULL,
                llm_raw_output TEXT NOT NULL,
                transaction_id INTEGER,
                created_at INTEGER NOT NULL
            )",
            [],
        )?;
        migrate_ledger_entry_v2(&connection);
        drop(connection);
        Ok(db)
    }
    pub fn get_connection(&self) -> Result<std::sync::MutexGuard<Connection>> {
        self.connection
            .lock()
            .map_err(|_| rusqlite::Error::InvalidQuery)
    }

    pub fn export_to_exp(&self) -> Result<Vec<u8>, Box<dyn Error>> {
        let conn = self.get_connection()?;
        conn.execute_batch("PRAGMA wal_checkpoint(FULL);")?;
        drop(conn);

        let mut db_path = env::var("HOME").unwrap_or_else(|_| ".".to_string());
        db_path.push_str("/Documents/expensify.db");
        let mut db_file = File::open(&db_path)?;
        let cursor = Cursor::new(Vec::new());
        let mut zip_writer = ZipWriter::new(cursor);
        let opts: FileOptions<ExtendedFileOptions> = FileOptions::default()
            .compression_method(CompressionMethod::Deflated)
            .unix_permissions(0o644);
        let metadata =
            serde_json::json!({"schema_version": "1", "exported_at": Utc::now().to_rfc3339()});

        zip_writer.start_file("metadata.json", opts.clone())?;
        zip_writer.write_all(metadata.to_string().as_bytes())?;

        zip_writer.start_file("expensify.db", opts)?;
        std::io::copy(&mut db_file, &mut zip_writer)?;

        let cursor = zip_writer.finish()?;

        return Ok(cursor.into_inner());
    }

    pub fn import_from_exp_bytes(&self, archive_bytes: Vec<u8>) -> Result<(), Box<dyn Error>> {
        let reader = Cursor::new(archive_bytes);
        let mut zip = ZipArchive::new(reader)?;
        let mut db_path = env::var("HOME").unwrap_or_else(|_| ".".into());
        db_path.push_str("/Documents/expensify.db");
        let tmp_path = format!("{}.tmp", db_path);

        for i in 0..zip.len() {
            let mut file = zip.by_index(i)?;
            let name = file.name();
            if name == "expensify.db" {
                let mut outfile = File::create(&tmp_path)?;
                std::io::copy(&mut file, &mut outfile)?;
            }
            // else if name == "metadata.json" {
            //     let mut meta = String::new();
            //     file.read_to_string(&mut meta)?;
            //     println!("Import metadata: {}", meta);
            // }
        }
        drop(self.get_connection()?);

        fs::rename(&tmp_path, &db_path)?;

        let new_conn = Connection::open(&db_path)?;
        let mut gaurd = self.get_connection()?;
        *gaurd = new_conn;
        Ok(())
    }

    pub fn drop_database_file(&self) -> Result<(), Box<dyn Error>> {
        let mut db_path = env::var("HOME").unwrap_or_else(|_| ".".into());
        db_path.push_str("/Documents/expensify.db");

        fs::remove_file(&db_path).map_err(|e| -> Box<dyn Error> { Box::new(e) })?;

        Ok(())
    }
    pub fn clear_all_data(&self) -> Result<(), Box<dyn Error>> {
        let conn = self.get_connection()?;
        conn.execute_batch(
            "BEGIN;
         DELETE FROM line_item;
         DELETE FROM ledger_entry;
         DELETE FROM transactions;
         DELETE FROM balance_overview;
         DELETE FROM category_budgets;
         DELETE FROM accounts;
         DELETE FROM categories;
         DELETE FROM appconstants;
         COMMIT;",
        )?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS appconstants(
             id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
             key TEXT UNIQUE,
             value TEXT
             );",
            [],
        )?;
        for (key, value) in DEFAULT_APP_CONSTANTS {
            let exists: Result<String> = conn.query_row(
                "SELECT key FROM appconstants WHERE key = ?1",
                params![key],
                |row| row.get(0),
            );

            if exists.is_err() {
                conn.execute(
                    "INSERT INTO appconstants (key, value) VALUES (?1, ?2);",
                    params![key, value],
                )?;
            }
        }
        Ok(())
    }
}
fn migrate_ledger_entry_v2(conn: &rusqlite::Connection) -> rusqlite::Result<()> {
    // quick check: does the new column already exist?
    let exists: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('ledger_entry') WHERE name='is_deleted';",
        [],
        |r| r.get(0),
    )?;
    if exists > 0 {
        return Ok(()); // already migrated
    }

    conn.execute_batch("PRAGMA foreign_keys = OFF; BEGIN TRANSACTION;")?;

    conn.execute_batch(
        "
        CREATE TABLE ledger_entry_new (
            id            TEXT PRIMARY KEY,
            kind          TEXT NOT NULL,
            description   TEXT,
            created_by    TEXT,
            created_at    TEXT,
            total_cents   BIGINT,
            updated_at    TEXT,
            transaction_id INTEGER
                REFERENCES transactions(id)
                ON DELETE SET NULL,
            is_deleted    INTEGER DEFAULT 0,
            is_dirty      INTEGER DEFAULT 0
        );

        INSERT INTO ledger_entry_new
            (id,kind,description,created_by,created_at,total_cents,updated_at,transaction_id,is_deleted,is_dirty)
        SELECT
            id,kind,description,created_by,created_at,total_cents,updated_at,transaction_id,0,0
        FROM ledger_entry;

        DROP TABLE ledger_entry;
        ALTER TABLE ledger_entry_new RENAME TO ledger_entry;

        CREATE INDEX IF NOT EXISTS le_upd_idx ON ledger_entry(updated_at);
        ",
    )?;

    conn.execute_batch("COMMIT; PRAGMA foreign_keys = ON;")?;
    Ok(())
}
pub static DB: Lazy<Database> =
    Lazy::new(|| Database::new().expect("failed to initialize database"));

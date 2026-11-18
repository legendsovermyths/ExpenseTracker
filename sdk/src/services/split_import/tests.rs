use rusqlite::{params, Connection};
use serde_json::json;

use super::db_utils::{
    apply_split_import, create_tables, fetch_import_batch, fetch_import_batches,
    fetch_unlinked_splits, undo_import_batch,
};
use super::model::ApplySplitImportPayload;

const ME: &str = "me";

fn db() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch(
        "CREATE TABLE categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, icon_name TEXT,
            icon_type TEXT, is_subcategory INTEGER, parent_category INTEGER, is_deleted INTEGER DEFAULT 0);
         CREATE TABLE accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, amount INTEGER,
            is_credit INTEGER DEFAULT 0, date_time TEXT, theme TEXT, due_date DATE, frequency TEXT,
            is_deleted INTEGER DEFAULT 0);
         CREATE TABLE transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, description TEXT NOT NULL,
            amount REAL NOT NULL, date_time TEXT NOT NULL, is_credit INTEGER NOT NULL,
            account_id INTEGER NOT NULL, category_id INTEGER NOT NULL, subcategory_id INTEGER NULL);
         CREATE TABLE ledger_entry (id TEXT PRIMARY KEY, kind TEXT NOT NULL, description TEXT,
            created_by TEXT, created_at TEXT, total_cents BIGINT, updated_at TEXT, transaction_id INTEGER,
            is_deleted INTEGER DEFAULT 0, is_dirty INTEGER DEFAULT 0, grp_id TEXT);
         CREATE TABLE line_item (id INTEGER PRIMARY KEY AUTOINCREMENT, entry_id TEXT NOT NULL,
            user_id TEXT NOT NULL, amount_cents BIGINT NOT NULL, paid_cents BIGINT NOT NULL,
            owed_cents BIGINT NOT NULL, updated_at TEXT);
         CREATE TABLE grp (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_by TEXT NOT NULL,
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0,
            is_dirty INTEGER NOT NULL DEFAULT 0);
         CREATE TABLE friends (friend_id TEXT PRIMARY KEY, friend_name TEXT NOT NULL, added_at TEXT NOT NULL);
         CREATE TABLE attachment (id TEXT PRIMARY KEY, owner_type TEXT NOT NULL, owner_id TEXT NOT NULL);
         CREATE TABLE attachment_blob (attachment_id TEXT PRIMARY KEY, data BLOB);
         CREATE TABLE balance_overview (friend_id TEXT PRIMARY KEY, friend_name TEXT NOT NULL, net_cents BIGINT NOT NULL);

         INSERT INTO categories VALUES (1, 'Food', 'food', 'material-community', 0, NULL, 0);
         INSERT INTO categories VALUES (2, 'Dining Out', 'silverware', 'material-community', 1, 1, 0);
         INSERT INTO categories VALUES (3, 'Others', 'dots', 'material-community', 0, NULL, 0);
         INSERT INTO accounts VALUES (1, 'HDFC', 1000, 0, '2026-01-01', 'blue', NULL, NULL, 0);
         INSERT INTO friends VALUES ('bob', 'Bob', '2026-01-01');
         INSERT INTO grp VALUES ('g1', 'Goa Trip', 'bob', '2026-01-01', '2026-01-01', 0, 0);",
    )
    .unwrap();
    create_tables(&conn).unwrap();
    conn
}

fn entry(conn: &Connection, id: &str, kind: &str, created_at: &str, my_owed: i64, grp: Option<&str>) {
    conn.execute(
        "INSERT INTO ledger_entry (id, kind, description, created_by, created_at, total_cents, updated_at, grp_id)
         VALUES (?1, ?2, ?3, 'bob', ?4, 1000, ?4, ?5)",
        params![id, kind, format!("desc {id}"), created_at, grp],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO line_item (entry_id, user_id, amount_cents, paid_cents, owed_cents) VALUES (?1, ?2, ?3, 0, ?4)",
        params![id, ME, -my_owed, my_owed],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO line_item (entry_id, user_id, amount_cents, paid_cents, owed_cents) VALUES (?1, 'bob', ?2, 1000, 0)",
        params![id, my_owed],
    )
    .unwrap();
}

fn payload(v: serde_json::Value) -> ApplySplitImportPayload {
    serde_json::from_value(v).unwrap()
}

fn balance(conn: &Connection) -> f64 {
    conn.query_row("SELECT amount FROM accounts WHERE id = 1", [], |r| r.get(0)).unwrap()
}

fn linked(conn: &Connection, id: &str) -> Option<i64> {
    conn.query_row("SELECT transaction_id FROM ledger_entry WHERE id = ?1", params![id], |r| r.get(0))
        .unwrap()
}

#[test]
fn fetch_excludes_payments_linked_deleted_and_zero_share() {
    let conn = db();
    entry(&conn, "a", "SPLIT", "2026-03-01", 250, None);
    entry(&conn, "b", "SPLIT", "2026-04-01", 400, Some("g1"));
    entry(&conn, "pay", "PAYMENT", "2026-04-02", 500, None);
    entry(&conn, "zero", "SPLIT", "2026-04-03", 0, None);
    entry(&conn, "linked", "SPLIT", "2026-04-04", 100, None);
    entry(&conn, "gone", "SPLIT", "2026-04-05", 100, None);
    conn.execute_batch(
        "UPDATE ledger_entry SET transaction_id = 99 WHERE id = 'linked';
         UPDATE ledger_entry SET is_deleted = 1 WHERE id = 'gone';",
    )
    .unwrap();

    let rows = fetch_unlinked_splits(&conn, ME, None, None).unwrap();
    let ids: Vec<_> = rows.iter().map(|r| r.entry_id.as_str()).collect();
    assert_eq!(ids, vec!["b", "a"]);
    assert_eq!(rows[0].grp_name.as_deref(), Some("Goa Trip"));
    assert_eq!(rows[1].counterpart_name.as_deref(), Some("Bob"));
    assert_eq!(rows[1].owed_cents, 250);

    let ranged = fetch_unlinked_splits(&conn, ME, Some("2026-03-15"), None).unwrap();
    assert_eq!(ranged.len(), 1);
}

#[test]
fn apply_creates_categories_links_and_debits_once_and_is_idempotent() {
    let mut conn = db();
    entry(&conn, "a", "SPLIT", "2026-03-01", 250, None);
    entry(&conn, "b", "SPLIT", "2026-03-02", 400, None);
    entry(&conn, "c", "SPLIT", "2026-03-03", 100, None);
    entry(&conn, "d", "SPLIT", "2026-03-04", 100, None);
    let p = json!({
        "batch_id": "job-1",
        "account_id": 1,
        "new_categories": [
            { "key": "pets", "name": "Pets", "parent_id": null, "icon_name": "paw", "icon_type": "material-community" },
            { "key": "brunch", "name": "Brunch", "parent_id": 1, "icon_name": "coffee", "icon_type": "material-community" },
            { "key": "food-again", "name": "food", "parent_id": null, "icon_name": "x", "icon_type": "material-community" }
        ],
        "items": [
            { "entry_id": "a", "description": "Vet", "amount": 2.5, "date_time": "2026-03-01", "new_category_key": "pets", "confidence": "high" },
            { "entry_id": "b", "description": "Eggs", "amount": 4.0, "date_time": "2026-03-02", "new_category_key": "brunch", "confidence": "medium" },
            // A subcategory sent as the category moves under its parent.
            { "entry_id": "c", "description": "Pizza", "amount": 1.0, "date_time": "2026-03-03", "category_id": 2, "confidence": "low" },
            // Reuses the existing "Food" instead of creating a duplicate.
            { "entry_id": "d", "description": "Snacks", "amount": 1.0, "date_time": "2026-03-04", "new_category_key": "food-again" },
            { "entry_id": "missing", "description": "?", "amount": 1.0, "date_time": "2026-03-04", "category_id": 1 }
        ]
    });
    let res = apply_split_import(&mut conn, payload(p.clone())).unwrap();
    assert_eq!(res.transactions.len(), 4);
    assert_eq!(res.skipped, 1);
    assert_eq!(res.categories.iter().map(|c| c.name.as_str()).collect::<Vec<_>>(), vec!["Pets", "Brunch"]);
    let brunch = &res.categories[1];
    assert!(brunch.is_subcategory && brunch.parent_category == Some(1));
    let t = |i: usize| &res.transactions[i];
    assert_eq!((t(1).category_id, t(1).subcategory_id), (1, brunch.id));
    assert_eq!((t(2).category_id, t(2).subcategory_id), (1, Some(2)));
    assert_eq!((t(3).category_id, t(3).subcategory_id), (1, None));
    assert_eq!(balance(&conn), 1000.0 - 8.5);
    assert_eq!(res.account.unwrap().amount, 1000.0 - 8.5);
    assert_eq!(linked(&conn, "a"), t(0).id.map(i64::from));

    // Re-applying the same job (crash before ack) changes nothing.
    let again = apply_split_import(&mut conn, payload(p)).unwrap();
    assert!(again.already_applied && again.transactions.is_empty());
    assert_eq!(balance(&conn), 1000.0 - 8.5);

    let batches = fetch_import_batches(&conn).unwrap();
    assert_eq!(batches.len(), 1);
    assert_eq!((batches[0].count, batches[0].created_categories), (4, 2));
    assert!((batches[0].total - 8.5).abs() < 1e-9);
    let items = fetch_import_batch(&conn, "job-1").unwrap();
    // New-category items first, then low confidence.
    assert!(items[0].is_new_category && items[1].is_new_category);
    assert_eq!(items[2].confidence.as_deref(), Some("low"));
}

#[test]
fn apply_rolls_back_everything_on_error() {
    let mut conn = db();
    entry(&conn, "a", "SPLIT", "2026-03-01", 250, None);
    entry(&conn, "b", "SPLIT", "2026-03-02", 400, None);
    let err = apply_split_import(
        &mut conn,
        payload(json!({
            "batch_id": "job-2", "account_id": 1,
            "new_categories": [{ "key": "pets", "name": "Pets", "icon_name": "paw", "icon_type": "material-community" }],
            "items": [
                { "entry_id": "a", "description": "Vet", "amount": 2.5, "date_time": "2026-03-01", "new_category_key": "pets" },
                { "entry_id": "b", "description": "?", "amount": 4.0, "date_time": "2026-03-02", "category_id": 77 }
            ]
        })),
    );
    assert!(err.is_err());
    assert_eq!(balance(&conn), 1000.0);
    assert_eq!(linked(&conn, "a"), None);
    let cats: i64 = conn.query_row("SELECT COUNT(*) FROM categories", [], |r| r.get(0)).unwrap();
    assert_eq!(cats, 3);
    assert!(fetch_import_batches(&conn).unwrap().is_empty());
}

#[test]
fn undo_restores_balance_unlinks_and_removes_unused_new_categories() {
    let mut conn = db();
    entry(&conn, "a", "SPLIT", "2026-03-01", 250, None);
    entry(&conn, "b", "SPLIT", "2026-03-02", 400, None);
    let res = apply_split_import(
        &mut conn,
        payload(json!({
            "batch_id": "job-3", "account_id": 1,
            "new_categories": [
                { "key": "pets", "name": "Pets", "icon_name": "paw", "icon_type": "material-community" },
                { "key": "gifts", "name": "Gifts", "icon_name": "gift", "icon_type": "material-community" }
            ],
            "items": [
                { "entry_id": "a", "description": "Vet", "amount": 2.5, "date_time": "2026-03-01", "new_category_key": "pets" },
                { "entry_id": "b", "description": "Card", "amount": 4.0, "date_time": "2026-03-02", "new_category_key": "gifts" }
            ]
        })),
    )
    .unwrap();
    // The user later adds their own transaction under "Gifts": it must survive the undo.
    let gifts = res.categories[1].id.unwrap();
    conn.execute(
        "INSERT INTO transactions (description, amount, date_time, is_credit, account_id, category_id) VALUES ('Mine', 1, 'x', 0, 1, ?1)",
        params![gifts],
    )
    .unwrap();
    // A receipt attached to an imported expense goes with it.
    conn.execute_batch(&format!(
        "INSERT INTO attachment VALUES ('att', 'TRANSACTION', '{0}');
         INSERT INTO attachment_blob VALUES ('att', x'00');",
        res.transactions[0].id.unwrap()
    ))
    .unwrap();
    // And deleted one imported transaction by hand (the app already refunded it).
    conn.execute("DELETE FROM transactions WHERE id = ?1", params![res.transactions[1].id]).unwrap();
    conn.execute("UPDATE accounts SET amount = amount + 4.0 WHERE id = 1", []).unwrap();

    let undone = undo_import_batch(&mut conn, "job-3").unwrap();
    assert_eq!(undone.removed_transactions, 1);
    assert_eq!(undone.removed_categories, 1);
    assert_eq!(balance(&conn), 1000.0);
    assert_eq!(linked(&conn, "a"), None);
    assert_eq!(linked(&conn, "b"), None);
    let deleted: Vec<(String, bool)> = conn
        .prepare("SELECT name, is_deleted FROM categories WHERE id > 3 ORDER BY id")
        .unwrap()
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();
    assert_eq!(deleted, vec![("Pets".into(), true), ("Gifts".into(), false)]);
    let attachments: i64 = conn
        .query_row("SELECT (SELECT COUNT(*) FROM attachment) + (SELECT COUNT(*) FROM attachment_blob)", [], |r| r.get(0))
        .unwrap();
    assert_eq!(attachments, 0);
    assert!(fetch_import_batches(&conn).unwrap().is_empty());
    assert!(undo_import_batch(&mut conn, "job-3").is_err());
    // The splits can be imported again by a new job...
    assert_eq!(fetch_unlinked_splits(&conn, ME, None, None).unwrap().len(), 2);
    // ...but re-applying the undone job (its ack failed) must not resurrect it.
    let replay = apply_split_import(
        &mut conn,
        payload(json!({
            "batch_id": "job-3", "account_id": 1,
            "items": [{ "entry_id": "a", "description": "Vet", "amount": 2.5, "date_time": "2026-03-01", "category_id": 1 }]
        })),
    )
    .unwrap();
    assert!(replay.already_applied);
    assert_eq!(balance(&conn), 1000.0);
    assert_eq!(linked(&conn, "a"), None);
}

//! "Import splits": turn unlinked splits into transactions in one go.
//!
//! Every function takes the connection explicitly so the whole apply/undo
//! runs inside one SQLite transaction (and so tests can use an in-memory db).

use std::collections::HashMap;
use std::error::Error;

use rusqlite::{params, Connection, OptionalExtension};

use crate::services::attachment::{db_utils::delete_attachments_for_owner, model::OWNER_TRANSACTION};
use crate::services::{account::model::Account, category::model::Category, transaction::model::Transaction};

use super::model::{
    AppliedSplitImport, ApplySplitImportPayload, ImportBatchItem, ImportBatchSummary,
    UndoneImportBatch, UnlinkedSplit,
};

const MAX_CATEGORY_NAME: usize = 40;

pub fn create_tables(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS split_import_batch (
            id          TEXT PRIMARY KEY,
            created_at  TEXT NOT NULL,
            account_id  INTEGER NOT NULL,
            -- Undone batches stay as tombstones so re-applying the same server
            -- job (e.g. after a failed ack) stays a no-op.
            undone_at   TEXT
        );
        CREATE TABLE IF NOT EXISTS split_import_batch_item (
            batch_id        TEXT NOT NULL,
            entry_id        TEXT NOT NULL,
            transaction_id  INTEGER NOT NULL,
            confidence      TEXT,
            is_new_category INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (batch_id, entry_id)
        );
        CREATE TABLE IF NOT EXISTS split_import_batch_category (
            batch_id    TEXT NOT NULL,
            category_id INTEGER NOT NULL,
            PRIMARY KEY (batch_id, category_id)
        );",
    )
}

/// Splits where I owe a share and that aren't linked to a transaction yet.
/// Payments and deleted entries are excluded. Newest first.
pub fn fetch_unlinked_splits(
    conn: &Connection,
    me: &str,
    start_date: Option<&str>,
    end_date: Option<&str>,
) -> rusqlite::Result<Vec<UnlinkedSplit>> {
    let mut stmt = conn.prepare(
        "SELECT le.id, le.description, le.created_at, li.owed_cents, g.name,
                COALESCE(
                  (SELECT f.friend_name FROM line_item o JOIN friends f ON f.friend_id = o.user_id
                    WHERE o.entry_id = le.id AND o.user_id <> ?1 LIMIT 1),
                  (SELECT b.friend_name FROM line_item o JOIN balance_overview b ON b.friend_id = o.user_id
                    WHERE o.entry_id = le.id AND o.user_id <> ?1 LIMIT 1))
         FROM   ledger_entry le
         JOIN   line_item li ON li.entry_id = le.id AND li.user_id = ?1
         LEFT JOIN grp g ON g.id = le.grp_id
         WHERE  le.transaction_id IS NULL
           AND  COALESCE(le.is_deleted, 0) = 0
           AND  le.kind = 'SPLIT'
           AND  li.owed_cents > 0
           AND  (?2 IS NULL OR le.created_at >= ?2)
           AND  (?3 IS NULL OR le.created_at <= ?3)
         ORDER BY le.created_at DESC, le.id",
    )?;
    let rows = stmt.query_map(params![me, start_date, end_date], |r| {
        Ok(UnlinkedSplit {
            entry_id: r.get(0)?,
            description: r.get(1)?,
            created_at: r.get(2)?,
            owed_cents: r.get(3)?,
            grp_name: r.get(4)?,
            counterpart_name: r.get(5)?,
        })
    })?;
    rows.collect()
}

fn read_account(conn: &Connection, id: u32) -> rusqlite::Result<Option<Account>> {
    conn.query_row(
        "SELECT id, amount, name, is_credit, date_time, theme, due_date, frequency, is_deleted
         FROM accounts WHERE id = ?1",
        params![id],
        |row| {
            Ok(Account {
                id: Some(row.get(0)?),
                amount: row.get(1)?,
                name: row.get(2)?,
                is_credit: row.get(3)?,
                date_time: row.get(4)?,
                theme: row.get(5)?,
                due_date: row.get(6)?,
                frequency: row.get(7)?,
                is_deleted: row.get(8)?,
            })
        },
    )
    .optional()
}

/// (is_subcategory, parent_category) of a live category.
fn category_shape(conn: &Connection, id: u32) -> rusqlite::Result<Option<(bool, Option<u32>)>> {
    conn.query_row(
        "SELECT COALESCE(is_subcategory, 0), parent_category FROM categories
         WHERE id = ?1 AND COALESCE(is_deleted, 0) = 0",
        params![id],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )
    .optional()
}

/// Resolves an item's category to a valid (category, subcategory) pair:
/// a subcategory given as the category moves under its parent, and a
/// subcategory that doesn't belong to the category is dropped.
fn resolve_category(
    conn: &Connection,
    category_id: u32,
    subcategory_id: Option<u32>,
) -> Result<(u32, Option<u32>), Box<dyn Error>> {
    match category_shape(conn, category_id)? {
        None => Err(format!("Category {category_id} no longer exists").into()),
        Some((true, Some(parent))) => Ok((parent, Some(category_id))),
        Some((true, None)) => Err(format!("Category {category_id} has no parent").into()),
        Some((false, _)) => {
            let sub = match subcategory_id {
                Some(s) => match category_shape(conn, s)? {
                    Some((true, Some(p))) if p == category_id => Some(s),
                    _ => None,
                },
                None => None,
            };
            Ok((category_id, sub))
        }
    }
}

/// Writes an import in a single SQLite transaction: creates the approved new
/// categories (reusing an existing one with the same name), adds one debit
/// transaction per split, links each split to its transaction, records the
/// batch for "Import results"/undo and debits the bank once.
///
/// Safe to re-run: an already-applied (or undone) batch is a no-op, and
/// splits that are already linked are skipped.
pub fn apply_split_import(
    conn: &mut Connection,
    p: ApplySplitImportPayload,
) -> Result<AppliedSplitImport, Box<dyn Error>> {
    let tx = conn.transaction()?;

    let exists: Option<String> = tx
        .query_row("SELECT id FROM split_import_batch WHERE id = ?1", params![p.batch_id], |r| r.get(0))
        .optional()?;
    if exists.is_some() {
        return Ok(AppliedSplitImport { already_applied: true, ..Default::default() });
    }

    match read_account(&tx, p.account_id)? {
        Some(a) if !a.is_deleted => {}
        _ => return Err("The bank account for this import no longer exists".into()),
    }

    // key → (category id, parent id if it's a subcategory, created by us)
    let mut keys: HashMap<String, (u32, Option<u32>, bool)> = HashMap::new();
    let mut created: Vec<Category> = Vec::new();
    for nc in &p.new_categories {
        let name: String = nc.name.trim().chars().take(MAX_CATEGORY_NAME).collect();
        if name.is_empty() {
            return Err("A new category has no name".into());
        }
        let parent = match nc.parent_id {
            Some(pid) => match category_shape(&tx, pid)? {
                Some((false, _)) => Some(pid),
                _ => None,
            },
            None => None,
        };
        let existing: Option<u32> = tx
            .query_row(
                "SELECT id FROM categories
                 WHERE COALESCE(is_deleted, 0) = 0 AND lower(trim(name)) = lower(?1)
                   AND COALESCE(is_subcategory, 0) = ?2 AND parent_category IS ?3
                 ORDER BY id LIMIT 1",
                params![name, parent.is_some(), parent],
                |r| r.get(0),
            )
            .optional()?;
        let id = match existing {
            Some(id) => id,
            None => {
                tx.execute(
                    "INSERT INTO categories (name, icon_name, icon_type, is_subcategory, parent_category, is_deleted)
                     VALUES (?1, ?2, ?3, ?4, ?5, 0)",
                    params![name, nc.icon_name, nc.icon_type, parent.is_some(), parent],
                )?;
                let id = tx.last_insert_rowid() as u32;
                tx.execute(
                    "INSERT OR IGNORE INTO split_import_batch_category (batch_id, category_id) VALUES (?1, ?2)",
                    params![p.batch_id, id],
                )?;
                created.push(Category {
                    id: Some(id),
                    name: name.clone(),
                    icon_name: nc.icon_name.clone(),
                    icon_type: nc.icon_type.clone(),
                    is_subcategory: parent.is_some(),
                    parent_category: parent,
                    is_deleted: false,
                });
                id
            }
        };
        keys.insert(nc.key.clone(), (id, parent, existing.is_none()));
    }

    let mut out = AppliedSplitImport::default();
    let mut total = 0.0;
    for item in &p.items {
        let linked: Option<Option<i64>> = tx
            .query_row(
                "SELECT transaction_id FROM ledger_entry WHERE id = ?1 AND COALESCE(is_deleted, 0) = 0",
                params![item.entry_id],
                |r| r.get(0),
            )
            .optional()?;
        if !matches!(linked, Some(None)) {
            out.skipped += 1;
            continue;
        }
        if !item.amount.is_finite() || item.amount <= 0.0 {
            return Err(format!("Split {} has an invalid amount", item.entry_id).into());
        }

        let (category_id, subcategory_id, is_new) = match &item.new_category_key {
            Some(key) => {
                let (id, parent, is_new) = *keys
                    .get(key)
                    .ok_or_else(|| format!("Unknown new category '{key}'"))?;
                match parent {
                    Some(parent) => (parent, Some(id), is_new),
                    None => (id, None, is_new),
                }
            }
            None => {
                let cat = item
                    .category_id
                    .ok_or_else(|| format!("Split {} has no category", item.entry_id))?;
                let (c, s) = resolve_category(&tx, cat, item.subcategory_id)?;
                (c, s, false)
            }
        };

        tx.execute(
            "INSERT INTO transactions (description, amount, date_time, account_id, category_id, subcategory_id, is_credit)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0)",
            params![item.description, item.amount, item.date_time, p.account_id, category_id, subcategory_id],
        )?;
        let txn_id = tx.last_insert_rowid() as u32;
        tx.execute(
            "UPDATE ledger_entry SET transaction_id = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![txn_id, item.entry_id],
        )?;
        tx.execute(
            "INSERT INTO split_import_batch_item (batch_id, entry_id, transaction_id, confidence, is_new_category)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![p.batch_id, item.entry_id, txn_id, item.confidence, is_new],
        )?;
        total += item.amount;
        out.transactions.push(Transaction {
            id: Some(txn_id),
            description: item.description.clone(),
            amount: item.amount,
            account_id: p.account_id,
            category_id,
            subcategory_id,
            date_time: item.date_time.clone(),
            is_credit: false,
        });
    }

    if out.transactions.is_empty() {
        // Nothing to import (all already linked): don't leave an empty batch
        // or unused categories behind.
        tx.rollback()?;
        return Ok(AppliedSplitImport { skipped: out.skipped, ..Default::default() });
    }

    tx.execute(
        "INSERT INTO split_import_batch (id, created_at, account_id) VALUES (?1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?2)",
        params![p.batch_id, p.account_id],
    )?;
    tx.execute(
        "UPDATE accounts SET amount = amount - ?1 WHERE id = ?2",
        params![total, p.account_id],
    )?;
    out.account = read_account(&tx, p.account_id)?;
    out.categories = created;
    tx.commit()?;
    Ok(out)
}

pub fn fetch_import_batches(conn: &Connection) -> rusqlite::Result<Vec<ImportBatchSummary>> {
    let mut stmt = conn.prepare(
        "SELECT b.id, b.created_at, b.account_id, COUNT(t.id), COALESCE(SUM(t.amount), 0),
                (SELECT COUNT(*) FROM split_import_batch_category c
                  JOIN categories k ON k.id = c.category_id AND COALESCE(k.is_deleted, 0) = 0
                  WHERE c.batch_id = b.id)
         FROM split_import_batch b
         LEFT JOIN split_import_batch_item i ON i.batch_id = b.id
         LEFT JOIN transactions t ON t.id = i.transaction_id
         WHERE b.undone_at IS NULL
         GROUP BY b.id
         ORDER BY b.created_at DESC",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(ImportBatchSummary {
            batch_id: r.get(0)?,
            created_at: r.get(1)?,
            account_id: r.get(2)?,
            count: r.get(3)?,
            total: r.get(4)?,
            created_categories: r.get(5)?,
        })
    })?;
    rows.collect()
}

/// The batch's transactions that still exist, needing-attention first
/// (new categories, then low confidence), then newest first.
pub fn fetch_import_batch(conn: &Connection, batch_id: &str) -> rusqlite::Result<Vec<ImportBatchItem>> {
    let mut stmt = conn.prepare(
        "SELECT i.entry_id, i.confidence, i.is_new_category,
                t.id, t.description, t.amount, t.account_id, t.category_id, t.subcategory_id, t.date_time, t.is_credit
         FROM split_import_batch_item i
         JOIN transactions t ON t.id = i.transaction_id
         WHERE i.batch_id = ?1
         ORDER BY i.is_new_category DESC,
                  CASE i.confidence WHEN 'low' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                  t.date_time DESC",
    )?;
    let rows = stmt.query_map(params![batch_id], |r| {
        Ok(ImportBatchItem {
            entry_id: r.get(0)?,
            confidence: r.get(1)?,
            is_new_category: r.get(2)?,
            transaction: Transaction {
                id: Some(r.get(3)?),
                description: r.get(4)?,
                amount: r.get(5)?,
                account_id: r.get(6)?,
                category_id: r.get(7)?,
                subcategory_id: r.get(8)?,
                date_time: r.get(9)?,
                is_credit: r.get(10)?,
            },
        })
    })?;
    rows.collect()
}

/// Reverses a batch: deletes its remaining transactions (crediting the bank
/// back), unlinks their splits and removes categories the batch created
/// that nothing uses any more.
pub fn undo_import_batch(conn: &mut Connection, batch_id: &str) -> Result<UndoneImportBatch, Box<dyn Error>> {
    let tx = conn.transaction()?;
    let live: Option<Option<String>> = tx
        .query_row("SELECT undone_at FROM split_import_batch WHERE id = ?1", params![batch_id], |r| r.get(0))
        .optional()?;
    match live {
        None => return Err("This import doesn't exist".into()),
        Some(Some(_)) => return Err("This import was already undone".into()),
        Some(None) => {}
    }

    let items: Vec<(String, u32, Option<(f64, u32, bool)>)> = {
        let mut stmt = tx.prepare(
            "SELECT i.entry_id, i.transaction_id, t.amount, t.account_id, t.is_credit
             FROM split_import_batch_item i
             LEFT JOIN transactions t ON t.id = i.transaction_id
             WHERE i.batch_id = ?1",
        )?;
        let rows = stmt.query_map(params![batch_id], |r| {
            let amount: Option<f64> = r.get(2)?;
            let txn = match amount {
                Some(a) => Some((a, r.get(3)?, r.get(4)?)),
                None => None,
            };
            Ok((r.get(0)?, r.get(1)?, txn))
        })?;
        rows.collect::<rusqlite::Result<_>>()?
    };

    let mut out = UndoneImportBatch::default();
    for (entry_id, txn_id, txn) in items {
        if let Some((amount, account_id, is_credit)) = txn {
            let delta = if is_credit { -amount } else { amount };
            tx.execute("UPDATE accounts SET amount = amount + ?1 WHERE id = ?2", params![delta, account_id])?;
            delete_attachments_for_owner(&tx, OWNER_TRANSACTION, &txn_id.to_string())?;
            tx.execute("DELETE FROM transactions WHERE id = ?1", params![txn_id])?;
            out.removed_transactions += 1;
        }
        tx.execute(
            "UPDATE ledger_entry SET transaction_id = NULL, updated_at = datetime('now')
             WHERE id = ?1 AND transaction_id = ?2",
            params![entry_id, txn_id],
        )?;
    }

    // Subcategories first, so a parent whose only children were ours goes too.
    let created: Vec<u32> = {
        let mut stmt = tx.prepare(
            "SELECT c.category_id FROM split_import_batch_category c
             JOIN categories k ON k.id = c.category_id
             WHERE c.batch_id = ?1 AND COALESCE(k.is_deleted, 0) = 0
             ORDER BY COALESCE(k.is_subcategory, 0) DESC",
        )?;
        let rows = stmt.query_map(params![batch_id], |r| r.get(0))?;
        rows.collect::<rusqlite::Result<_>>()?
    };
    for id in created {
        let removed = tx.execute(
            "UPDATE categories SET is_deleted = 1
             WHERE id = ?1
               AND NOT EXISTS (SELECT 1 FROM transactions WHERE category_id = ?1 OR subcategory_id = ?1)
               AND NOT EXISTS (SELECT 1 FROM categories WHERE parent_category = ?1 AND COALESCE(is_deleted, 0) = 0)",
            params![id],
        )?;
        out.removed_categories += removed;
    }

    tx.execute("DELETE FROM split_import_batch_item WHERE batch_id = ?1", params![batch_id])?;
    tx.execute("DELETE FROM split_import_batch_category WHERE batch_id = ?1", params![batch_id])?;
    tx.execute(
        "UPDATE split_import_batch SET undone_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1",
        params![batch_id],
    )?;
    tx.commit()?;
    Ok(out)
}

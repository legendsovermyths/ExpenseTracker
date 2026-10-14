use std::error::Error;

use rusqlite::{params, Connection, Row};

use crate::services::database::DB;

use super::model::{
    AttachmentOwner, AttachmentRow, DocumentedItem, NewAttachment, OWNER_SPLIT, OWNER_TRANSACTION,
};

const META_COLUMNS: &str = "a.id, a.owner_type, a.owner_id, a.file_name, a.mime_type, a.size_bytes,
     a.doc_type, a.doc_type_source, a.thumbnail_b64, a.created_at";

fn row_to_attachment(row: &Row) -> rusqlite::Result<AttachmentRow> {
    Ok(AttachmentRow {
        id: row.get(0)?,
        owner_type: row.get(1)?,
        owner_id: row.get(2)?,
        file_name: row.get(3)?,
        mime_type: row.get(4)?,
        size_bytes: row.get(5)?,
        doc_type: row.get(6)?,
        doc_type_source: row.get(7)?,
        thumbnail_b64: row.get(8)?,
        created_at: row.get(9)?,
    })
}

pub fn insert_attachments_in_database(
    attachments: Vec<NewAttachment>,
) -> Result<Vec<AttachmentRow>, Box<dyn Error>> {
    let mut conn = DB.get_connection()?;
    let tx = conn.transaction()?;
    let mut saved = Vec::with_capacity(attachments.len());
    for a in attachments {
        let m = a.meta;
        tx.execute(
            "INSERT INTO attachment
                (id, owner_type, owner_id, file_name, mime_type, size_bytes,
                 doc_type, doc_type_source, thumbnail_b64, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10);",
            params![
                m.id,
                m.owner_type,
                m.owner_id,
                m.file_name,
                m.mime_type,
                m.size_bytes,
                m.doc_type,
                m.doc_type_source,
                m.thumbnail_b64,
                m.created_at
            ],
        )?;
        tx.execute(
            "INSERT INTO attachment_blob (attachment_id, data_b64) VALUES (?1, ?2);",
            params![m.id, a.data_b64],
        )?;
        saved.push(m);
    }
    tx.commit()?;
    Ok(saved)
}

/// Attachments of an owner, plus those of its linked counterpart
/// (a split's linked transaction, or the splits linked to a transaction).
pub fn list_attachments_from_database(
    owner_type: &str,
    owner_id: &str,
) -> Result<Vec<AttachmentRow>, Box<dyn Error>> {
    let conn = DB.get_connection()?;
    let linked_clause = if owner_type == OWNER_TRANSACTION {
        "(a.owner_type = 'SPLIT' AND a.owner_id IN (
            SELECT id FROM ledger_entry
            WHERE transaction_id = CAST(?2 AS INTEGER) AND COALESCE(is_deleted, 0) = 0))"
    } else {
        "(a.owner_type = 'TRANSACTION' AND a.owner_id IN (
            SELECT CAST(transaction_id AS TEXT) FROM ledger_entry
            WHERE id = ?2 AND transaction_id IS NOT NULL))"
    };
    let sql = format!(
        "SELECT {META_COLUMNS} FROM attachment a
         WHERE (a.owner_type = ?1 AND a.owner_id = ?2) OR {linked_clause}
         ORDER BY a.created_at ASC;"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map(params![owner_type, owner_id], row_to_attachment)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

pub fn get_attachment_from_database(id: &str) -> Result<AttachmentRow, Box<dyn Error>> {
    let conn = DB.get_connection()?;
    let sql = format!("SELECT {META_COLUMNS} FROM attachment a WHERE a.id = ?1;");
    Ok(conn.query_row(&sql, params![id], row_to_attachment)?)
}

pub fn get_attachment_data_from_database(id: &str) -> Result<String, Box<dyn Error>> {
    let conn = DB.get_connection()?;
    Ok(conn.query_row(
        "SELECT data_b64 FROM attachment_blob WHERE attachment_id = ?1;",
        params![id],
        |r| r.get(0),
    )?)
}

pub fn update_attachment_type_in_database(
    id: &str,
    doc_type: Option<&str>,
    source: Option<&str>,
) -> Result<(), Box<dyn Error>> {
    let conn = DB.get_connection()?;
    conn.execute(
        // An AI guess never replaces a type the user picked themselves.
        "UPDATE attachment SET doc_type = ?2, doc_type_source = ?3
         WHERE id = ?1
           AND NOT (COALESCE(?3, '') = 'AI' AND COALESCE(doc_type_source, '') = 'USER');",
        params![id, doc_type, source],
    )?;
    Ok(())
}

pub fn delete_attachments_from_database(ids: &[String]) -> Result<(), Box<dyn Error>> {
    let mut conn = DB.get_connection()?;
    let tx = conn.transaction()?;
    for id in ids {
        tx.execute("DELETE FROM attachment_blob WHERE attachment_id = ?1;", params![id])?;
        tx.execute("DELETE FROM attachment WHERE id = ?1;", params![id])?;
    }
    tx.commit()?;
    Ok(())
}

/// Removes every attachment owned by the given owner. Takes a connection so it
/// can run inside callers that already hold the DB lock.
pub fn delete_attachments_for_owner(
    conn: &Connection,
    owner_type: &str,
    owner_id: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "DELETE FROM attachment_blob WHERE attachment_id IN
            (SELECT id FROM attachment WHERE owner_type = ?1 AND owner_id = ?2);",
        params![owner_type, owner_id],
    )?;
    conn.execute(
        "DELETE FROM attachment WHERE owner_type = ?1 AND owner_id = ?2;",
        params![owner_type, owner_id],
    )?;
    Ok(())
}

pub fn delete_attachments_for_owner_in_database(
    owner_type: &str,
    owner_id: &str,
) -> Result<(), Box<dyn Error>> {
    let conn = DB.get_connection()?;
    delete_attachments_for_owner(&conn, owner_type, owner_id)?;
    Ok(())
}

/// Every owner that has attachments, directly or through a linked
/// split ↔ transaction pair. Cheap: no thumbnails or blobs.
pub fn list_attachment_owners_from_database() -> Result<Vec<AttachmentOwner>, Box<dyn Error>> {
    let conn = DB.get_connection()?;
    let mut stmt = conn.prepare(
        "SELECT DISTINCT owner_type, owner_id FROM attachment
         UNION
         SELECT 'TRANSACTION', CAST(le.transaction_id AS TEXT)
           FROM attachment a JOIN ledger_entry le ON le.id = a.owner_id
          WHERE a.owner_type = 'SPLIT' AND le.transaction_id IS NOT NULL
         UNION
         SELECT 'SPLIT', le.id
           FROM attachment a JOIN ledger_entry le
             ON le.transaction_id = CAST(a.owner_id AS INTEGER)
          WHERE a.owner_type = 'TRANSACTION' AND COALESCE(le.is_deleted, 0) = 0;",
    )?;
    let rows = stmt
        .query_map([], |r| {
            Ok(AttachmentOwner {
                owner_type: r.get(0)?,
                owner_id: r.get(1)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

pub fn list_documented_items_from_database(
    doc_type: Option<&str>,
    me_id: Option<&str>,
) -> Result<Vec<DocumentedItem>, Box<dyn Error>> {
    let conn = DB.get_connection()?;
    // ?1 = doc type filter (NULL = all), ?2 = me id
    let having = "HAVING ?1 IS NULL
        OR SUM(CASE WHEN COALESCE(a.doc_type, 'UNCLASSIFIED') = ?1 THEN 1 ELSE 0 END) > 0";
    let thumb = |owner: &str| {
        format!(
            "(SELECT a2.thumbnail_b64 FROM attachment a2
               WHERE a2.owner_type = '{owner}' AND a2.owner_id = a.owner_id
                 AND a2.thumbnail_b64 IS NOT NULL
               ORDER BY a2.created_at LIMIT 1)"
        )
    };
    let sql = format!(
        "SELECT 'TRANSACTION', a.owner_id, t.description, t.amount, t.is_credit, t.date_time,
                t.category_id, NULL, NULL, COUNT(*),
                GROUP_CONCAT(DISTINCT COALESCE(a.doc_type, 'UNCLASSIFIED')), {txn_thumb}
           FROM attachment a
           JOIN transactions t ON t.id = CAST(a.owner_id AS INTEGER)
          WHERE a.owner_type = '{OWNER_TRANSACTION}'
          GROUP BY a.owner_id {having}
         UNION ALL
         SELECT 'SPLIT', a.owner_id, le.description, le.total_cents / 100.0, 0, le.created_at,
                NULL, {cp_id}, (SELECT bo.friend_name FROM balance_overview bo
                                 WHERE bo.friend_id = {cp_id}), COUNT(*),
                GROUP_CONCAT(DISTINCT COALESCE(a.doc_type, 'UNCLASSIFIED')), {split_thumb}
           FROM attachment a
           JOIN ledger_entry le ON le.id = a.owner_id AND COALESCE(le.is_deleted, 0) = 0
          WHERE a.owner_type = '{OWNER_SPLIT}'
          GROUP BY a.owner_id {having};",
        txn_thumb = thumb(OWNER_TRANSACTION),
        split_thumb = thumb(OWNER_SPLIT),
        cp_id = "(SELECT li.user_id FROM line_item li
                   WHERE li.entry_id = le.id AND li.user_id != COALESCE(?2, '') LIMIT 1)",
    );
    let mut stmt = conn.prepare(&sql)?;
    let mut rows = stmt
        .query_map(params![doc_type, me_id], |r| {
            let types: Option<String> = r.get(10)?;
            Ok(DocumentedItem {
                owner_type: r.get(0)?,
                owner_id: r.get(1)?,
                description: r.get(2)?,
                amount: r.get(3)?,
                is_credit: r.get(4)?,
                date_time: r.get::<_, Option<String>>(5)?.unwrap_or_default(),
                category_id: r.get(6)?,
                counterparty_id: r.get(7)?,
                counterparty_name: r.get(8)?,
                attachment_count: r.get(9)?,
                doc_types: types
                    .map(|s| s.split(',').map(|t| t.to_string()).collect())
                    .unwrap_or_default(),
                thumbnail_b64: r.get(11)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    rows.sort_by(|a, b| b.date_time.cmp(&a.date_time));
    Ok(rows)
}

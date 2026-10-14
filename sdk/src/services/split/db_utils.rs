use std::error::Error;

use rusqlite::params;

use crate::services::database::DB;

use super::model::{LiWithEntry, LineItemInfo, SplitSummary};
use super::pairwise::pairwise_net;

/// Every entry `me` and `friend` both take part in, reduced to two rows per
/// entry (one for each of them) whose `amount_cents` is the pairwise amount
/// between just the two — for 1:1 splits that's simply `me`'s line item; for
/// group expenses it's their proportional share (see `pairwise_net`).
pub fn fetch_friend_ledger_from_database(
    me: &str,
    friend: &str,
    start_date: Option<&str>,
    end_date: Option<&str>,
) -> Result<Vec<LiWithEntry>, rusqlite::Error> {
    let conn = DB.get_connection()?;

    let mut query = String::from(
        "
        SELECT
            le.id,
            le.description,
            le.created_at,
            le.kind,
            le.transaction_id,
            le.is_dirty,
            le.grp_id,
            g.name,
            li.user_id,
            li.amount_cents
        FROM   ledger_entry le
        JOIN   line_item    li ON li.entry_id = le.id
        LEFT JOIN grp       g  ON g.id = le.grp_id
        WHERE  le.is_deleted = 0
          AND  EXISTS (SELECT 1 FROM line_item x WHERE x.entry_id = le.id AND x.user_id = ?1)
          AND  EXISTS (SELECT 1 FROM line_item y WHERE y.entry_id = le.id AND y.user_id = ?2)
        ",
    );

    let mut bind_values: Vec<String> = Vec::new();
    if let Some(start_date) = start_date {
        query.push_str(" AND le.created_at >= ?");
        bind_values.push(start_date.to_string());
    }
    if let Some(end_date) = end_date {
        query.push_str(" AND le.created_at <= ?");
        bind_values.push(end_date.to_string());
    }
    query.push_str(" ORDER BY le.created_at DESC, le.id;");

    let mut stmt = conn.prepare(&query)?;
    let mut all_params: Vec<&dyn rusqlite::ToSql> = vec![&me, &friend];
    for v in &bind_values {
        all_params.push(v as &dyn rusqlite::ToSql);
    }

    struct Head {
        description: Option<String>,
        created_at: String,
        kind: String,
        transaction_id: Option<usize>,
        is_dirty: bool,
        grp_id: Option<String>,
        grp_name: Option<String>,
        items: Vec<(String, i64)>,
    }

    let mut order: Vec<String> = Vec::new();
    let mut heads: std::collections::HashMap<String, Head> = std::collections::HashMap::new();
    let mut rows = stmt.query(all_params.as_slice())?;
    while let Some(row) = rows.next()? {
        let id: String = row.get(0)?;
        let user_id: String = row.get(8)?;
        let amount: i64 = row.get(9)?;
        if !heads.contains_key(&id) {
            order.push(id.clone());
            heads.insert(
                id.clone(),
                Head {
                    description: row.get(1)?,
                    created_at: row.get(2)?,
                    kind: row.get(3)?,
                    transaction_id: row.get(4)?,
                    is_dirty: row.get(5)?,
                    grp_id: row.get(6)?,
                    grp_name: row.get(7)?,
                    items: Vec::new(),
                },
            );
        }
        heads.get_mut(&id).unwrap().items.push((user_id, amount));
    }

    let mut out = Vec::new();
    for id in order {
        let h = heads.remove(&id).unwrap();
        let net = pairwise_net(&h.items, me, friend);
        // In a group expense two members can both owe a third person —
        // nothing passes between them, so it doesn't belong in their ledger.
        if h.items.len() > 2 && net == 0 {
            continue;
        }
        for (user_id, amount_cents) in [(me.to_string(), net), (friend.to_string(), -net)] {
            out.push(LiWithEntry {
                entry_id: id.clone(),
                user_id,
                amount_cents,
                description: h.description.clone(),
                created_at: h.created_at.clone(),
                kind: h.kind.clone(),
                transaction_id: h.transaction_id,
                is_dirty: h.is_dirty,
                grp_id: h.grp_id.clone(),
                grp_name: h.grp_name.clone(),
            });
        }
    }
    Ok(out)
}

pub fn fetch_split_summary_from_database(
    entry_id: &str,
) -> Result<SplitSummary, Box<dyn std::error::Error>> {
    let conn = DB.get_connection()?;
    let (description, transaction_id, created_at, total_cents, kind, created_by, grp_id): (
        Option<String>,
        Option<usize>,
        String,
        i64,
        String,
        Option<String>,
        Option<String>,
    ) = conn.query_row(
        "SELECT description, transaction_id, created_at, total_cents, kind, created_by, grp_id
         FROM ledger_entry WHERE id = ?1;",
        params![entry_id],
        |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
            ))
        },
    )?;

    let mut stmt = conn.prepare(
        "
        SELECT user_id, amount_cents, paid_cents, owed_cents
        FROM   line_item
        WHERE  entry_id = ?1;
        ",
    )?;

    let item_iter = stmt.query_map(params![entry_id], |row| {
        Ok(LineItemInfo {
            user_id: row.get(0)?,
            amount_cents: row.get(1)?,
            paid_cents: row.get(2)?,
            owed_cents: row.get(3)?,
        })
    })?;

    let mut items = Vec::new();
    for it in item_iter {
        items.push(it?);
    }

    Ok(SplitSummary {
        description,
        items,
        transaction_id,
        created_at,
        total_cents,
        kind,
        created_by,
        grp_id,
    })
}

pub fn delete_split_from_database(entry_id: &str)->Result<(), Box<dyn Error>>{
    let conn = DB.get_connection()?;
    conn.execute(
        "UPDATE ledger_entry SET is_deleted = 1, is_dirty = 1 WHERE id = ?1;",
        params![entry_id],
    )?;
    Ok(())
}

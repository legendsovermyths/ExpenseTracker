use std::collections::HashMap;
use std::error::Error;

use rusqlite::{params, Connection};

use crate::services::database::DB;
use crate::services::split::pairwise::pairwise_net;

use super::model::{
    GroupDetail, GroupExpense, GroupMemberBalance, GroupMemberRow, GroupRow, GroupSummary,
};

const GROUP_COLUMNS: &str = "id, name, created_by, created_at, updated_at, is_deleted";
const MEMBER_COLUMNS: &str = "grp_id, user_id, user_name, joined_at, updated_at, is_deleted";

fn map_group_row(row: &rusqlite::Row) -> rusqlite::Result<GroupRow> {
    Ok(GroupRow {
        id: row.get(0)?,
        name: row.get(1)?,
        created_by: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
        is_deleted: row.get(5)?,
    })
}

fn map_member_row(row: &rusqlite::Row) -> rusqlite::Result<GroupMemberRow> {
    Ok(GroupMemberRow {
        grp_id: row.get(0)?,
        user_id: row.get(1)?,
        user_name: row.get(2)?,
        joined_at: row.get(3)?,
        updated_at: row.get(4)?,
        is_deleted: row.get(5)?,
    })
}

// `dirty` = true for local edits (pushed on next sync), false for rows
// arriving from Supabase.
fn upsert_group(conn: &Connection, g: &GroupRow, dirty: bool) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO grp (id, name, created_by, created_at, updated_at, is_deleted, is_dirty)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            created_by = excluded.created_by,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at,
            is_deleted = excluded.is_deleted,
            is_dirty = excluded.is_dirty;",
        params![g.id, g.name, g.created_by, g.created_at, g.updated_at, g.is_deleted, dirty],
    )?;
    Ok(())
}

fn upsert_member(conn: &Connection, m: &GroupMemberRow, dirty: bool) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO grp_member (grp_id, user_id, user_name, joined_at, updated_at, is_deleted, is_dirty)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(grp_id, user_id) DO UPDATE SET
            user_name = COALESCE(excluded.user_name, grp_member.user_name),
            joined_at = excluded.joined_at,
            updated_at = excluded.updated_at,
            is_deleted = excluded.is_deleted,
            is_dirty = excluded.is_dirty;",
        params![
            m.grp_id,
            m.user_id,
            m.user_name,
            m.joined_at,
            m.updated_at,
            m.is_deleted,
            dirty
        ],
    )?;
    Ok(())
}

pub fn upsert_group_with_members_in_database(
    group: &GroupRow,
    members: &[GroupMemberRow],
    dirty: bool,
) -> Result<(), Box<dyn Error>> {
    let mut conn = DB.get_connection()?;
    let tx = conn.transaction()?;
    upsert_group(&tx, group, dirty)?;
    for m in members {
        upsert_member(&tx, m, dirty)?;
    }
    tx.commit()?;
    Ok(())
}

pub fn sync_groups_in_database(
    groups: &[GroupRow],
    members: &[GroupMemberRow],
) -> Result<(), Box<dyn Error>> {
    let mut conn = DB.get_connection()?;
    let tx = conn.transaction()?;
    for g in groups {
        upsert_group(&tx, g, false)?;
    }
    for m in members {
        upsert_member(&tx, m, false)?;
    }
    tx.commit()?;
    Ok(())
}

pub fn soft_delete_group_in_database(grp_id: &str, updated_at: &str) -> Result<(), Box<dyn Error>> {
    let conn = DB.get_connection()?;
    conn.execute(
        "UPDATE grp SET is_deleted = 1, is_dirty = 1, updated_at = ?2 WHERE id = ?1",
        params![grp_id, updated_at],
    )?;
    Ok(())
}

pub fn get_dirty_group_data_from_database(
) -> Result<(Vec<GroupRow>, Vec<GroupMemberRow>), Box<dyn Error>> {
    let conn = DB.get_connection()?;
    let mut stmt = conn.prepare(&format!("SELECT {GROUP_COLUMNS} FROM grp WHERE is_dirty = 1"))?;
    let groups = stmt
        .query_map([], map_group_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let mut stmt =
        conn.prepare(&format!("SELECT {MEMBER_COLUMNS} FROM grp_member WHERE is_dirty = 1"))?;
    let members = stmt
        .query_map([], map_member_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok((groups, members))
}

fn get_members(conn: &Connection, grp_id: &str) -> rusqlite::Result<Vec<GroupMemberRow>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {MEMBER_COLUMNS} FROM grp_member
         WHERE grp_id = ?1 AND is_deleted = 0
         ORDER BY joined_at, user_id"
    ))?;
    let rows = stmt.query_map(params![grp_id], map_member_row)?;
    rows.collect()
}

pub fn get_groups_for_user_from_database(user_id: &str) -> Result<Vec<GroupSummary>, Box<dyn Error>> {
    let conn = DB.get_connection()?;
    let mut stmt = conn.prepare(&format!(
        "SELECT {GROUP_COLUMNS} FROM grp g
         WHERE g.is_deleted = 0
           AND EXISTS (SELECT 1 FROM grp_member m
                       WHERE m.grp_id = g.id AND m.user_id = ?1 AND m.is_deleted = 0)"
    ))?;
    let groups = stmt
        .query_map(params![user_id], map_group_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    let mut out = Vec::new();
    for g in groups {
        let members = get_members(&conn, &g.id)?;
        let (my_net_cents, last_activity_at): (i64, Option<String>) = conn.query_row(
            "SELECT
                COALESCE(SUM(CASE WHEN li.user_id = ?2 THEN li.amount_cents ELSE 0 END), 0),
                MAX(le.created_at)
             FROM ledger_entry le
             LEFT JOIN line_item li ON li.entry_id = le.id
             WHERE le.grp_id = ?1 AND le.is_deleted = 0",
            params![g.id, user_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )?;
        out.push(GroupSummary {
            group: g,
            members,
            my_net_cents,
            last_activity_at,
        });
    }
    out.sort_by(|a, b| {
        let ka = a.last_activity_at.as_deref().unwrap_or(&a.group.created_at);
        let kb = b.last_activity_at.as_deref().unwrap_or(&b.group.created_at);
        kb.cmp(ka)
    });
    Ok(out)
}

pub fn get_group_detail_from_database(grp_id: &str, me: &str) -> Result<GroupDetail, Box<dyn Error>> {
    let conn = DB.get_connection()?;
    let group = conn.query_row(
        &format!("SELECT {GROUP_COLUMNS} FROM grp WHERE id = ?1"),
        params![grp_id],
        map_group_row,
    )?;
    let members = get_members(&conn, grp_id)?;

    let mut stmt = conn.prepare(
        "SELECT le.id, le.description, le.created_at, le.kind, le.total_cents, le.created_by,
                le.transaction_id, le.is_dirty, li.user_id, li.amount_cents, li.paid_cents
         FROM ledger_entry le
         JOIN line_item li ON li.entry_id = le.id
         WHERE le.grp_id = ?1 AND le.is_deleted = 0
         ORDER BY le.created_at DESC, le.id",
    )?;
    let mut rows = stmt.query(params![grp_id])?;

    let mut order: Vec<String> = Vec::new();
    let mut expenses: HashMap<String, GroupExpense> = HashMap::new();
    let mut items: HashMap<String, Vec<(String, i64)>> = HashMap::new();
    while let Some(row) = rows.next()? {
        let id: String = row.get(0)?;
        let user_id: String = row.get(8)?;
        let amount: i64 = row.get(9)?;
        let paid: i64 = row.get(10)?;
        let e = expenses.entry(id.clone()).or_insert_with(|| {
            order.push(id.clone());
            GroupExpense {
                entry_id: id.clone(),
                description: row.get(1).unwrap_or(None),
                created_at: row.get(2).unwrap_or_default(),
                kind: row.get(3).unwrap_or_default(),
                total_cents: row.get(4).unwrap_or(0),
                created_by: row.get(5).unwrap_or(None),
                transaction_id: row.get(6).unwrap_or(None),
                is_dirty: row.get(7).unwrap_or(false),
                my_net_cents: 0,
                payer_ids: Vec::new(),
            }
        });
        if user_id == me {
            e.my_net_cents = amount;
        }
        if paid > 0 {
            e.payer_ids.push(user_id.clone());
        }
        items.entry(id).or_default().push((user_id, amount));
    }

    let mut balances: HashMap<String, i64> = HashMap::new();
    let mut my_net_cents = 0;
    let mut total_spent_cents = 0;
    for id in &order {
        let e = &expenses[id];
        my_net_cents += e.my_net_cents;
        if e.kind == "SPLIT" {
            total_spent_cents += e.total_cents;
        }
        let its = &items[id];
        for (user_id, _) in its {
            if user_id != me {
                *balances.entry(user_id.clone()).or_insert(0) += pairwise_net(its, me, user_id);
            }
        }
    }

    let member_balances = members
        .iter()
        .filter(|m| m.user_id != me)
        .map(|m| GroupMemberBalance {
            user_id: m.user_id.clone(),
            net_cents: *balances.get(&m.user_id).unwrap_or(&0),
        })
        .collect();

    let expenses = order
        .into_iter()
        .map(|id| expenses.remove(&id).unwrap())
        .collect();

    Ok(GroupDetail {
        group,
        members,
        expenses,
        member_balances,
        my_net_cents,
        total_spent_cents,
    })
}

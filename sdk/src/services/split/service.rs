use std::error::Error;

use super::{
    db_utils::fetch_friend_ledger_from_database,
    ledger_entry::{db_utils::upsert_ledger_entries_in_database, model::LedgerEntryRow},
    line_item::{db_utils::upsert_line_items_in_database, model::LineItemRow},
    model::LiWithEntry,
};

pub fn upsert_split_entries(
    line_item_rows: Vec<LineItemRow>,
    ledger_entry_rows: Vec<LedgerEntryRow>,
) -> Result<(), Box<dyn Error>> {
    upsert_line_items_in_database(line_item_rows)?;
    upsert_ledger_entries_in_database(ledger_entry_rows)?;
    Ok(())
}

pub fn fetch_friend_ledger(
    me_id: &str,
    friend_id: &str,
) -> Result<Vec<LiWithEntry>, Box<dyn Error>> {
    let res = fetch_friend_ledger_from_database(me_id, friend_id)?;
    Ok(res)
}

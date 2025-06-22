use std::error::Error;

use super::{
    db_utils::{delete_split_from_database, fetch_friend_ledger_from_database, fetch_split_summary_from_database},
    ledger_entry::{
        self,
        db_utils::{
            add_ledger_entries_in_database, get_dirty_ledger_enteries_from_database,
            upsert_ledger_entries_in_database,
        },
        model::LedgerEntryRow,
    },
    line_item::{
        db_utils::{
            get_line_items_for_dirty_ledger_entries_from_database, upsert_line_items_in_database,
        },
        model::LineItemRow,
    },
    model::{LiWithEntry, SplitSummary},
};

pub fn upsert_split_entries(
    line_item_rows: Vec<LineItemRow>,
    ledger_entry_rows: Vec<LedgerEntryRow>,
) -> Result<(), Box<dyn Error>> {
    upsert_ledger_entries_in_database(ledger_entry_rows)?;
    upsert_line_items_in_database(line_item_rows)?;
    Ok(())
}

pub fn add_split_entries(
    line_item_rows: Vec<LineItemRow>,
    ledger_entry_rows: Vec<LedgerEntryRow>,
) -> Result<(), Box<dyn Error>> {
    add_ledger_entries_in_database(ledger_entry_rows)?;
    upsert_line_items_in_database(line_item_rows)?;
    Ok(())
}

pub fn get_dirty_split_enteries() -> Result<(Vec<LedgerEntryRow>, Vec<LineItemRow>), Box<dyn Error>>
{
    let ledger_entries = get_dirty_ledger_enteries_from_database()?;
    let line_items = get_line_items_for_dirty_ledger_entries_from_database()?;
    Ok((ledger_entries, line_items))
}

pub fn fetch_friend_ledger(
    me_id: &str,
    friend_id: &str,
) -> Result<Vec<LiWithEntry>, Box<dyn Error>> {
    let res = fetch_friend_ledger_from_database(me_id, friend_id)?;
    Ok(res)
}

pub fn fetch_split_summary(entry_id: &str) -> Result<SplitSummary, Box<dyn Error>> {
    let res = fetch_split_summary_from_database(entry_id)?;
    Ok(res)
}

pub fn delete_split(entry_id: &str) -> Result<(), Box<dyn Error>>{
    let res = delete_split_from_database(entry_id)?;
    Ok(res)
}

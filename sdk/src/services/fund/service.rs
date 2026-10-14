use std::error::Error;

use super::{
    db_utils::{
        get_dirty_fund_entries_from_database, get_dirty_funds_from_database,
        get_fund_entries_from_database, get_fund_from_database,
        get_fund_total_contributed_from_database, get_funds_for_user_from_database,
        insert_or_update_fund, insert_or_update_fund_entry, soft_delete_fund_entry_in_database,
        soft_delete_fund_in_database, upsert_fund_entry_from_sync, upsert_fund_from_sync,
    },
    model::{FundEntryRow, FundRow},
};

pub fn upsert_fund(fund: FundRow) -> Result<FundRow, Box<dyn Error>> {
    insert_or_update_fund(fund.clone())?;
    Ok(fund)
}

pub fn delete_fund(fund_id: &str, updated_at: &str) -> Result<(), Box<dyn Error>> {
    soft_delete_fund_in_database(fund_id, updated_at)
}

pub fn fetch_funds(user_id: &str) -> Result<Vec<FundRow>, Box<dyn Error>> {
    get_funds_for_user_from_database(user_id)
}

pub fn fetch_fund_detail(
    fund_id: &str,
) -> Result<(FundRow, Vec<FundEntryRow>, i64), Box<dyn Error>> {
    let fund = get_fund_from_database(fund_id)?;
    let entries = get_fund_entries_from_database(fund_id)?;
    let total = get_fund_total_contributed_from_database(fund_id)?;
    Ok((fund, entries, total))
}

pub fn add_fund_entry(entry: FundEntryRow) -> Result<FundEntryRow, Box<dyn Error>> {
    insert_or_update_fund_entry(entry.clone())?;
    Ok(entry)
}

pub fn update_fund_entry(entry: FundEntryRow) -> Result<FundEntryRow, Box<dyn Error>> {
    insert_or_update_fund_entry(entry.clone())?;
    Ok(entry)
}

pub fn delete_fund_entry(entry_id: &str, updated_at: &str) -> Result<(), Box<dyn Error>> {
    soft_delete_fund_entry_in_database(entry_id, updated_at)
}

pub fn get_dirty_fund_data() -> Result<(Vec<FundRow>, Vec<FundEntryRow>), Box<dyn Error>> {
    let funds = get_dirty_funds_from_database()?;
    let entries = get_dirty_fund_entries_from_database()?;
    Ok((funds, entries))
}

pub fn sync_fund_data(
    funds: Vec<FundRow>,
    entries: Vec<FundEntryRow>,
) -> Result<(), Box<dyn Error>> {
    for f in funds {
        upsert_fund_from_sync(f)?;
    }
    for e in entries {
        upsert_fund_entry_from_sync(e)?;
    }
    Ok(())
}

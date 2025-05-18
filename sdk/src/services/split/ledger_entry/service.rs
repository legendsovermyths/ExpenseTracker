use std::error::Error;

use super::db_utils::link_transaction_to_entry_in_database;

pub fn link_transaction_to_ledger_entry(
    ledger_entry_id: &str,
    transaction_id: usize,
) -> Result<(), Box<dyn Error>> {
    let _res = link_transaction_to_entry_in_database(ledger_entry_id, transaction_id)?;
    Ok(())
}

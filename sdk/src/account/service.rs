use std::error::Error;

use super::{db_utils::add_account_to_database, model::Account};

pub fn add_account(account: Account) -> Result<Account, Box<dyn Error>> {
    let account = add_account_to_database(account)?;
    Ok(account)
}

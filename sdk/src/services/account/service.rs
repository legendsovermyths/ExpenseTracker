use std::error::Error;

use super::{
    db_utils::{add_account_to_database, get_all_accounts_from_database},
    model::Account,
};

pub fn add_account(account: Account) -> Result<Account, Box<dyn Error>> {
    let account = add_account_to_database(account)?;
    Ok(account)
}

pub fn get_all_accounts() -> Result<Vec<Account>, Box<dyn Error>> {
    let accounts = get_all_accounts_from_database()?;
    return Ok(accounts);
}

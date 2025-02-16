use super::{
    db_utils::{
        add_account_to_database, delete_account_from_database, get_all_accounts_from_database,
        update_account_in_database,
    },
    model::Account,
};
use crate::services::utils::service::calculate_next_date;
use chrono::{format::parse, DateTime, Utc};
use std::error::Error;

pub fn add_account(account: Account) -> Result<Account, Box<dyn Error>> {
    let account = add_account_to_database(account)?;
    Ok(account)
}

pub fn delete_account(account: Account) -> Result<(), Box<dyn Error>> {
    if let Some(id) = account.id {
        delete_account_from_database(id)?;
        Ok(())
    } else {
        Err("account does not contain an id".into())
    }
}

pub fn update_account(account: Account) -> Result<Account, Box<dyn Error>> {
    let account = update_account_in_database(account)?;
    Ok(account)
}

pub fn update_duedate_of_accounts(accounts: Vec<Account>) -> Result<Vec<Account>, Box<dyn Error>> {
    println!("account: {:?}", accounts);
    let mut new_accounts = Vec::new();
    for mut account in accounts.into_iter() {
        let mut account_updated = false;
        if let Some(val) = &account.due_date {
            let datetime_str = val;
            let mut parsed_datetime = DateTime::parse_from_rfc3339(datetime_str)
                .expect("Failed to parse datetime")
                .with_timezone(&Utc);
            let now_datetime = Utc::now();
            if let Some(frequency) = &account.frequency {
                while parsed_datetime < now_datetime {
                    account_updated = true;
                    parsed_datetime =
                        calculate_next_date(&parsed_datetime.to_rfc3339(), frequency)?;
                }
                if account_updated {
                    account.due_date = Some(parsed_datetime.to_rfc3339());
                    let new_account = update_account_in_database(account)?;
                    new_accounts.push(new_account);
                } else {
                    new_accounts.push(account);
                }
            } else {
                return Err("The bank has due date but no frequency".into());
            }
        } else {
            new_accounts.push(account);
        }
    }
    println!("new account:{:?}", new_accounts);
    Ok(new_accounts)
}

pub fn get_all_accounts() -> Result<Vec<Account>, Box<dyn Error>> {
    let accounts = get_all_accounts_from_database()?;
    let updated_accounts = update_duedate_of_accounts(accounts)?;
    return Ok(updated_accounts);
}

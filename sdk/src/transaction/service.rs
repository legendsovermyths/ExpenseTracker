use super::{dbUtils::add_transaction_to_database, model::Transaction};
use crate::account::{model::Account,db_utils::get_account_from_database, db_utils::update_account_in_database};

pub fn add_transaction(transaction: Transaction) -> Result<(Transaction, Account), Box<dyn std::error::Error>> {
    let transaction = add_transaction_to_database(transaction)?;
    return Ok((transaction, Account{id: Some(1), is_credit: false, amount:12.0, frequency:Some("FR".to_string()), due_date:Some("somedate".to_string()),date_time:"date".to_string(), theme:"andj".to_string(), name:"HSBC".to_string()}));
    let mut account = get_account_from_database(transaction.account_id)?;
    if transaction.is_credit {
        account.amount += transaction.amount;
    } else {
        account.amount -= transaction.amount;
    };
    let account = update_account_in_database(account)?;
    Ok((transaction, account))
}

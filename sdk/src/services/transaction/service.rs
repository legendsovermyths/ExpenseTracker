use super::{dbUtils::{add_transaction_to_database, get_all_transaction_from_database}, model::Transaction};
use crate::services::account::{model::Account,db_utils::get_account_from_database, db_utils::update_account_in_database};

pub fn add_transaction(transaction: Transaction) -> Result<(Transaction, Account), Box<dyn std::error::Error>> {
    let transaction = add_transaction_to_database(transaction)?;
    let mut account = get_account_from_database(transaction.account_id)?;
    if transaction.is_credit {
        account.amount += transaction.amount;
    } else {
        account.amount -= transaction.amount;
    };
    let account = update_account_in_database(account)?;
    Ok((transaction, account))
}

pub fn get_all_transacations()->Result<Vec<Transaction>, Box<dyn std::error::Error>>{
    let transactions = get_all_transaction_from_database()?;
    return Ok(transactions);
}

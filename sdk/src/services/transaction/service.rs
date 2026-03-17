use super::{
    dbUtils::{
        add_transaction_to_database, delete_transaction_from_database,
        get_all_transaction_from_database, get_transaction_from_database,
        update_transaction_in_database,
    },
    model::Transaction,
};
use crate::services::account::{
    db_utils::get_account_from_database, db_utils::update_account_in_database, model::Account,
};

pub fn add_transaction(
    transaction: Transaction,
) -> Result<(Transaction, Account), Box<dyn std::error::Error>> {
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

pub fn update_transaction(
    transaction: Transaction,
) -> Result<(Transaction, Account), Box<dyn std::error::Error>> {
    let mut account = get_account_from_database(transaction.account_id)?;
    if let Some(id) = transaction.id {
        let old_transaction = get_transaction_from_database(id)?;
        if old_transaction.is_credit {
            account.amount -= old_transaction.amount;
        } else {
            account.amount += old_transaction.amount;
        }
        let transaction = update_transaction_in_database(transaction)?;
        if transaction.is_credit {
            account.amount += transaction.amount;
        } else {
            account.amount -= transaction.amount;
        }
        let account = update_account_in_database(account)?;
        return Ok((transaction, account));
    } else {
        // the transaction to be updated is without the id something is horribly wrong
        return Err("The transaction to be updated is without the id".into());
    }
}

pub fn delete_transaction(
    transaction: Transaction,
) -> Result<(Transaction, Account), Box<dyn std::error::Error>> {
    let mut account = get_account_from_database(transaction.account_id)?;
    if transaction.is_credit {
        account.amount -= transaction.amount;
    } else {
        account.amount += transaction.amount;
    }
    let account = update_account_in_database(account)?;
    if let Some(id) = transaction.id {
        delete_transaction_from_database(id)?;
    }
    return Ok((transaction, account));
}

pub fn get_all_transacations() -> Result<Vec<Transaction>, Box<dyn std::error::Error>> {
    let transactions = get_all_transaction_from_database()?;
    return Ok(transactions);
}

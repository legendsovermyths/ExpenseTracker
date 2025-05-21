use super::{
    db_utils::{get_all_balances_from_db, update_balances_in_db},
    model::UserBalance,
};
use std::error::Error;

pub fn get_all_user_balances() -> Result<Vec<UserBalance>, Box<dyn Error>> {
    let res = get_all_balances_from_db()?;
    return Ok(res);
}

pub fn update_all_user_balances(arr: Vec<UserBalance>) -> Result<(), Box<dyn Error>> {
    let res = update_balances_in_db(arr)?;
    return Ok(res);
}


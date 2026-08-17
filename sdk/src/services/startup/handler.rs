use std::error::Error;

use serde::Deserialize;
use serde_json::Value;

use crate::{
    api::response::{Entity, Response},
    services::{
        account::service::get_all_accounts, appconstants::service::get_all_appconstants,
        category::service::get_all_categories,
        category_budget::service::get_all_category_budgets,
        split::balance_overview::service::get_all_user_balances,
        transaction::model::GetTransactionsPayload,
        transaction::service::get_transactions_since,
    },
};

use super::service::handle_entity_fetch;

#[derive(Debug, Deserialize, Default)]
pub struct GetDataPayload {
    pub transactions_since: Option<String>,
}

pub fn get_data_jshandler(payload: Option<Value>) -> Value {
    let mut response = Response::new();

    // `transactions_since` bounds the transactions fetched here to a hot
    // window (e.g. last 6 months) — the caller controls the cutoff so this
    // doesn't load the entire all-time transaction history on every launch.
    let transactions_since = payload
        .and_then(|v| serde_json::from_value::<GetDataPayload>(v).ok())
        .and_then(|p| p.transactions_since);

    handle_entity_fetch(
        || {
            get_transactions_since(GetTransactionsPayload {
                start_date: transactions_since,
                ..Default::default()
            })
        },
        Entity::Transaction,
        &mut response,
        "Failed to fetch transactions",
    );
    handle_entity_fetch(
        get_all_accounts,
        Entity::Account,
        &mut response,
        "Failed to fetch accounts",
    );

    handle_entity_fetch(
        get_all_categories,
        Entity::Category,
        &mut response,
        "Failed to fetch categories",
    );

    handle_entity_fetch(
        get_all_appconstants,
        Entity::Appconstant,
        &mut response,
        "Failed to fetch appconstant",
    );

    handle_entity_fetch(
        get_all_user_balances,
        Entity::UserBalance,
        &mut response,
        "Failed to fetch userbalances",
    );

    handle_entity_fetch(
        get_all_category_budgets,
        Entity::CategoryBudget,
        &mut response,
        "Failed to fetch category budgets",
    );

    response.get_value()
}

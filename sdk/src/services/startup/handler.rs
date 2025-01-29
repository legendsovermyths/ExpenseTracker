use std::error::Error;

use serde_json::Value;

use crate::{
    api::response::{Entity, Response},
    services::{
        account::service::get_all_accounts, category::service::get_all_categories,
        transaction::service::get_all_transacations,
    },
};

use super::service::handle_entity_fetch;

pub fn get_data_jshandler(_payload: Option<Value>) -> Value {
    let mut response = Response::new();

    handle_entity_fetch(
        get_all_transacations,
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

    response.get_value()
}

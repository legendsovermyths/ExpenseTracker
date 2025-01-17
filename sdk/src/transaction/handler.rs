use crate::{
    account::model::Account,
    api::response::{Entity, Response},
};
use serde_json::Value;

use super::{
    model::{Transaction, TransactionPayload},
    service::add_transaction,
};

pub fn add_transaction_jshandler(payload: Option<Value>) -> Value {
    let mut response = Response::new();
    if let Some(payload_value) = payload {
        let transaction_payload: TransactionPayload = match serde_json::from_value(payload_value) {
            Ok(payload) => payload,
            Err(err) => {
                response.set_status("error");
                response.set_message(&format!("failed to deserialize the payload, {}", err));
                return response.get_value();
            }
        };
        let transaction = transaction_payload.transaction;
        let result = add_transaction(transaction);
        match result {
            Ok(value) => {
                let (transaction, account): (Transaction, Account) = value;
                response.set_status("success");
                response.push_addition(Entity::Transaction(transaction));
                response.push_update(Entity::Account(account));
                return response.get_value();
            }
            Err(err) => {
                response.set_status("error");
                response.set_message(&err.to_string());
                return response.get_value();
            }
        }
    }
    response.set_status("error");
    response.set_message("Payload is missing");
    return response.get_value();
}

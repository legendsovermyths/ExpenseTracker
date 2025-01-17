use serde_json::Value;

use crate::api::response::{Entity, Response};

use super::{model::AccountPayload, service::add_account};

pub fn add_account_jshandler(payload: Option<Value>) -> Value {
    let mut response = Response::new();
    if let Some(payload_value) = payload {
        let account_payload: AccountPayload = match serde_json::from_value(payload_value) {
            Ok(account_payload) => account_payload,
            Err(err) => {
                response.set_status("Error");
                response.set_message(&format!("Failed to deserialize payload, {}", err));
                return response.get_value();
            }
        };
        let account = account_payload.account;
        let result = add_account(account);
        match result {
            Ok(account) => {
                response.set_status("success");
                response.push_addition(Entity::Account(account));
                return response.get_value();
            }
            Err(err) => {
                response.set_status("error");
                response.set_message(&format!("Failed to add account,{}", err));
                return response.get_value();
            }
        }
    } else {
        response.set_status("error");
        response.set_message("Payload is missing");
        return response.get_value();
    }
}

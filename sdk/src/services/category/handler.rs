use serde_json::Value;

use crate::api::response::{Entity, Response};

use super::{model::CategoryPayload, service::add_category};

pub fn add_category_jshandler(payload: Option<Value>)->Value{
    let mut response = Response::new();

    if let Some(payload_value) = payload {
        let category_payload: CategoryPayload = match serde_json::from_value(payload_value) {
            Ok(category_payload) => category_payload,
            Err(err) => {
                response.set_status("error");
                response.set_message(&format!("Failed to deserialize payload, {}", err));
                return response.get_value();
            }
        };
        let category = category_payload.category;
        let result = add_category(category);
        match result {
            Ok(category) => {
                response.set_status("success");
                response.push_addition(Entity::Category(category));
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

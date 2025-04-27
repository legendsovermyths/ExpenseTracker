use crate::api::response::{Entity, Response};
use crate::services::appconstants::model::Appconstant;
use crate::services::appconstants::service::{
    add_appconstant, delete_appconstant, update_appconstant,
};
use serde_json::Value;

use super::model::AppconstantPayload;

pub fn add_appconstant_jshandler(payload: Option<Value>) -> Value {
    let mut response = Response::new();
    if let Some(payload_value) = payload {
        let appconstant_payload: AppconstantPayload = match serde_json::from_value(payload_value) {
            Ok(appconstant_payload) => appconstant_payload,
            Err(err) => {
                response.set_status("error");
                response.set_message(&format!("Failed to deserialize payload, {}", err));
                return response.get_value();
            }
        };
        let appconstant  = appconstant_payload.appconstant;
        match add_appconstant(appconstant) {
            Ok(appconstant) => {
                response.set_status("success");
                response.push_addition(Entity::Appconstant(appconstant));
            }
            Err(err) => {
                response.set_status("error");
                response.set_message(&format!("Failed to add appconstant, {}", err));
            }
        }
    } else {
        response.set_status("error");
        response.set_message("Payload is missing");
    }
    response.get_value()
}

pub fn update_appconstant_jshandler(payload: Option<Value>) -> Value {
    let mut response = Response::new();
    if let Some(payload_value) = payload {
        let appconstant_payload: AppconstantPayload = match serde_json::from_value(payload_value) {
            Ok(appconstant_payload) => appconstant_payload,
            Err(err) => {
                response.set_status("error");
                response.set_message(&format!("Failed to deserialize payload, {}", err));
                return response.get_value();
            }
        };
        let appconstant = appconstant_payload.appconstant;
        match update_appconstant(appconstant) {
            Ok(appconstant) => {
                response.set_status("success");
                response.push_update(Entity::Appconstant(appconstant));
            }
            Err(err) => {
                response.set_status("error");
                response.set_message(&format!("Failed to update appconstant, {}", err));
            }
        }
    } else {
        response.set_status("error");
        response.set_message("Payload is missing");
    }
    response.get_value()
}

pub fn delete_appconstant_jshandler(payload: Option<Value>) -> Value {
    let mut response = Response::new();
    if let Some(payload_value) = payload {
        let appconstant_payload: Appconstant = match serde_json::from_value(payload_value) {
            Ok(appconstant_payload) => appconstant_payload,
            Err(err) => {
                response.set_status("error");
                response.set_message(&format!("Failed to deserialize payload, {}", err));
                return response.get_value();
            }
        };

        match delete_appconstant(appconstant_payload) {
            Ok(_) => response.set_status("success"),
            Err(err) => {
                response.set_status("error");
                response.set_message(&format!("Failed to delete appconstant, {}", err));
            }
        }
    } else {
        response.set_status("error");
        response.set_message("Payload is missing");
    }
    response.get_value()
}

use serde_json::Value;

use crate::{api::response::Response, services::database::DB};

use super::model::FilePayload;

pub fn export_data_jshandler(_payload: Option<Value>) -> Value {
    let mut response = Response::new();
    let bytes = DB.export_to_exp();
    match bytes {
        Ok(bytes) => {
            response.add_file_as_bytes(bytes);
        }
        Err(err) => {
            response.set_status("error");
            response.set_message(&err.to_string());
        }
    }
    return response.get_value();
}

pub fn delete_all_data_jshandler(_payload: Option<Value>) -> Value {
    let mut response = Response::new();

    let res = DB.clear_all_data();
    match res {
        Ok(_) => {
            response.set_status("success");
        }
        Err(err) => {
            response.set_status("error");
            response.set_message(&err.to_string());
        }
    }
    return response.get_value();
}

pub fn import_data_jshandler(payload: Option<Value>) -> Value {
    let mut response = Response::new();
    if let Some(payload) = payload {
        let file_payload: FilePayload = match serde_json::from_value(payload) {
            Ok(file_payload) => file_payload,
            Err(err) => {
                response.set_status("error");
                response.set_message(&err.to_string());
                return response.get_value();
            }
        };
        let file = file_payload.file;
        let result = DB.import_from_exp_bytes(file);
        match result {
            Ok(_) => {
                response.set_status("success");
                return response.get_value();
            }
            Err(err) => {
                response.set_status("error");
                response.set_message(&err.to_string());
                return response.get_value();
            }
        }
    } else {
        response.set_status("error");
        response.set_message("Payload doesn't exist");
        return response.get_value();
    }
}

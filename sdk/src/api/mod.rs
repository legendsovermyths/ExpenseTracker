pub mod actions;
pub mod request;

use serde_json::{json, Value};
use super::api::actions::Action;
use super::api::request::Request;

pub fn handle_request(input: &str) -> String {
    let request: Request = match serde_json::from_str(input) {
        Ok(req) => req,
        Err(_) => return create_error_response("Invalid JSON format"),
    };

    match request.action {
        Action::GetTransactions => request.payload.unwrap().to_string()
    }
}

fn create_success_response(data: Value) -> String {
    json!({ "success": true, "data": data }).to_string()
}

fn create_error_response(message: &str) -> String {
    json!({ "success": false, "error": message }).to_string()
}

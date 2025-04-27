pub mod actions;
pub mod js_handler;
pub mod request;
pub mod response;

use super::api::actions::Action;
use super::api::request::Request;
use js_handler::JsHandler;
use serde_json::{json, Value};

pub fn handle_request(input: &str) -> String {
    let request: Request = match serde_json::from_str(input) {
        Ok(req) => req,
        Err(_) => return create_error_response(json!({"message": "Invalid request"})),
    };
    let js_handler = JsHandler::get_js_handler();
    let response = js_handler.execute_action(request.action, request.payload);
    response.to_string()
}

fn create_success_response(data: Value) -> String {
    json!({ "success": true, "data": data }).to_string()
}

fn create_error_response(data: Value) -> String {
    json!({ "success": false, "data": data }).to_string()
}


pub mod actions;
pub mod js_handler;
pub mod request;

use super::api::actions::Action;
use super::api::request::Request;
use js_handler::JsHandler;
use serde_json::{json, Value};
use std::sync::OnceLock;

static JS_HANDLER: OnceLock<JsHandler> = OnceLock::new();

pub fn handle_request(input: &str) -> String {
    let request: Request = match serde_json::from_str(input) {
        Ok(req) => req,
        Err(_) => return create_error_response("Invalid JSON format"),
    };
    let js_handler = get_js_handler();
    js_handler.execute_action(request.action, request.payload)
}

fn create_success_response(data: Value) -> String {
    json!({ "success": true, "data": data }).to_string()
}

fn create_error_response(message: &str) -> String {
    json!({ "success": false, "error": message }).to_string()
}

fn get_js_handler() -> &'static JsHandler {
    JS_HANDLER.get_or_init(JsHandler::new)
}

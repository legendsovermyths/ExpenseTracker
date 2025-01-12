use super::Action;
use std::collections::HashMap;

use crate::transaction::handler;

pub struct JsHandler {
    pub handler: HashMap<Action, Box<dyn Fn(Option<serde_json::Value>) -> String + Sync + Send>>,
}

impl JsHandler {
    pub fn new() -> Self {
        let handler = HashMap::new();
        let mut js_handler = JsHandler { handler };
        js_handler.register(Action::AddTransaction, Box::new(handler::add_transaction_jshandler));
        js_handler
    }
    pub fn register(
        &mut self,
        action: Action,
        func: Box<dyn Fn(Option<serde_json::Value>) -> String + Sync + Send>,
    ) {
        self.handler.insert(action, func);
    }
    pub fn execute_action(&self, action: Action, payload: Option<serde_json::Value>) -> String {
        let handler_action = self.handler.get(&action);
        if let Some(action) = handler_action {
            action(payload)
        } else {
            "Action not registered".to_string()
        }
    }
}

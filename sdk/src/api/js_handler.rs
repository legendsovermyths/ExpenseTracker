use super::Action;
use crate::{account::handler::add_account_jshandler, transaction::handler::add_transaction_jshandler};
use serde_json::{json, Value};
use std::collections::HashMap;

pub struct JsHandler {
    pub handler: HashMap<Action, Box<dyn Fn(Option<Value>) -> Value + Sync + Send>>,
}

impl JsHandler {
    pub fn new() -> Self {
        let handler = HashMap::new();
        let mut js_handler = JsHandler { handler };
        js_handler.register(Action::AddTransaction,Box::new(add_transaction_jshandler));
        js_handler.register(Action::AddAccount, Box::new(add_account_jshandler));
        js_handler
    }
    pub fn register(
        &mut self,
        action: Action,
        func: Box<dyn Fn(Option<Value>) -> Value + Sync + Send>,
    ) {
        self.handler.insert(action, func);
    }
    pub fn execute_action(&self, action: Action, payload: Option<Value>) -> Value {
        let handler_action = self.handler.get(&action);
        if let Some(action) = handler_action {
            action(payload)
        } else {
            json!({"message": "The action doesn't exist"})
        }
    }
}

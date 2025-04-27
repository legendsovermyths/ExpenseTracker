use super::Action;
use crate::services::appconstants::handler::{add_appconstant_jshandler, delete_appconstant_jshandler, update_appconstant_jshandler};
use crate::services::category::handler::{add_category_jshandler, delete_category_jshandler, update_category_jshandler};
use crate::services::startup::handler::get_data_jshandler;
use crate::services::transaction::handler::{delete_transaction_jshandler, update_transaction_jshandler};
use crate::services::{
    account::handler::add_account_jshandler,account::handler::delete_account_jshandler, transaction::handler::add_transaction_jshandler,
};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::OnceLock;

static JS_HANDLER: OnceLock<JsHandler> = OnceLock::new();

pub struct JsHandler {
    pub handler: HashMap<Action, Box<dyn Fn(Option<Value>) -> Value + Sync + Send>>,
}

impl JsHandler {
    pub fn new() -> Self {
        let handler = HashMap::new();
        let mut js_handler = JsHandler { handler };
        js_handler.register(Action::AddTransaction, Box::new(add_transaction_jshandler));
        js_handler.register(Action::AddAccount, Box::new(add_account_jshandler));
        js_handler.register(Action::AddCategory, Box::new(add_category_jshandler));
        js_handler.register(Action::GetData, Box::new(get_data_jshandler));
        js_handler.register(Action::DeleteAccount, Box::new(delete_account_jshandler));
        js_handler.register(Action::DeleteCategory, Box::new(delete_category_jshandler));
        js_handler.register(Action::UpdateCategory, Box::new(update_category_jshandler));
        js_handler.register(Action::UpdateTransaction, Box::new(update_transaction_jshandler));
        js_handler.register(Action::DeleteTransaction, Box::new(delete_transaction_jshandler));
        js_handler.register(Action::AddAppconstant, Box::new(add_appconstant_jshandler));
        js_handler.register(Action::UpdateAppconstant, Box::new(update_appconstant_jshandler));
        js_handler.register(Action::DeleteAppconstant, Box::new(delete_appconstant_jshandler));
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

    pub fn get_js_handler() -> &'static JsHandler {
        JS_HANDLER.get_or_init(JsHandler::new)
    }
}

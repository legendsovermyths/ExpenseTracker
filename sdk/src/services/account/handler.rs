use serde_json::Value;

use crate::api::js_handler::handle;

use super::{
    model::{AccountAdded, AccountDeleted, AccountPayload},
    service::{add_account, delete_account},
};

pub fn add_account_jshandler(payload: Option<Value>) -> Value {
    handle::<AccountPayload, AccountAdded, _>(payload, |p| {
        let acc = add_account(p.account)?;
        Ok(AccountAdded(acc))
    })
}

pub fn delete_account_jshandler(payload: Option<Value>) -> Value {
    handle::<AccountPayload, AccountDeleted, _>(payload, |p| {
        let acc = delete_account(p.account)?;
        Ok(AccountDeleted(acc))
    })
}


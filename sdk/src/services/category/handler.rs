use super::{
    model::{CategoryAdded, CategoryDeleted, CategoryPayload, CategoryUpdated},
    service::{add_category, delete_category, update_category},
};
use crate::api::js_handler::handle;
use serde_json::Value;

pub fn add_category_jshandler(payload: Option<Value>) -> Value {
    handle::<CategoryPayload, CategoryAdded, _>(payload, |p| {
        let category = add_category(p.category)?;
        Ok(CategoryAdded(category))
    })
}

pub fn update_category_jshandler(payload: Option<Value>) -> Value {
    handle::<CategoryPayload, CategoryUpdated, _>(payload, |p| {
        let category = update_category(p.category)?;
        Ok(CategoryUpdated(category))
    })
}

pub fn delete_category_jshandler(payload: Option<Value>) -> Value {
    handle::<CategoryPayload, CategoryDeleted, _>(payload, |p| {
        let category = delete_category(p.category)?;
        Ok(CategoryDeleted(category))
    })
}

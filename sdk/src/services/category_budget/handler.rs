use super::{
    model::{CategoryBudgetPayload, CategoryBudgetUpserted, DeleteCategoryBudgetPayload, CategoryBudgetDeleted},
    service::{upsert_category_budget, delete_category_budget},
};
use crate::api::js_handler::handle;
use serde_json::Value;

pub fn upsert_category_budget_jshandler(payload: Option<Value>) -> Value {
    handle::<CategoryBudgetPayload, CategoryBudgetUpserted, _>(payload, |p| {
        let budget = upsert_category_budget(p.category_budget)?;
        Ok(CategoryBudgetUpserted(budget))
    })
}

pub fn delete_category_budget_jshandler(payload: Option<Value>) -> Value {
    handle::<DeleteCategoryBudgetPayload, CategoryBudgetDeleted, _>(payload, |p| {
        delete_category_budget(p.category_id)?;
        Ok(CategoryBudgetDeleted)
    })
}

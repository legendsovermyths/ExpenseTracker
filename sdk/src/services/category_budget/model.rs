use serde::{Deserialize, Serialize};

use crate::api::response::IntoResponse;

#[derive(Debug, Deserialize, Serialize)]
pub struct CategoryBudget {
    pub id: Option<u32>,
    pub category_id: u32,
    pub amount: f64,
}

#[derive(Debug, Deserialize)]
pub struct CategoryBudgetPayload {
    pub category_budget: CategoryBudget,
}

#[derive(Debug, Deserialize)]
pub struct DeleteCategoryBudgetPayload {
    pub category_id: u32,
}

pub struct CategoryBudgetUpserted(pub CategoryBudget);
pub struct CategoryBudgetDeleted;

impl IntoResponse for CategoryBudgetUpserted {
    fn write_into(self, r: &mut crate::api::response::Response) {
        r.push_addition(crate::api::response::Entity::CategoryBudget(self.0));
    }
}

impl IntoResponse for CategoryBudgetDeleted {
    fn write_into(self, _r: &mut crate::api::response::Response) {}
}

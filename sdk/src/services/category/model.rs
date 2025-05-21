use serde::{Deserialize, Serialize};

use crate::api::response::IntoResponse;

#[derive(Debug, Deserialize, Serialize)]
pub struct Category {
    pub id: Option<u32>,
    pub name: String,
    pub icon_name: String,
    pub icon_type: String,
    pub is_subcategory: bool,
    pub parent_category: Option<u32>,
    pub is_deleted: bool,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct CategoryPayload {
    pub category: Category,
}

pub struct CategoryAdded(pub Category);
pub struct CategoryUpdated(pub Category);
pub struct CategoryDeleted(pub Category);

impl IntoResponse for CategoryAdded {
    fn write_into(self, r: &mut crate::api::response::Response) {
        r.push_addition(crate::api::response::Entity::Category(self.0));
    }
}

impl IntoResponse for CategoryUpdated {
    fn write_into(self, r: &mut crate::api::response::Response) {
        r.push_update(crate::api::response::Entity::Category(self.0));
    }
}

impl IntoResponse for CategoryDeleted {
    fn write_into(self, r: &mut crate::api::response::Response) {}
}

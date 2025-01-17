use serde::{Deserialize, Serialize};

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

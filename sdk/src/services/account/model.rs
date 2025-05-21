use serde::{Deserialize, Serialize};

use crate::api::response::IntoResponse;

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Account {
    pub id: Option<u32>,
    pub amount: f64,
    pub name: String,
    pub is_credit: bool,
    pub date_time: String,
    pub theme: String,
    pub due_date: Option<String>,
    pub frequency: Option<String>,
    pub is_deleted: bool,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct AccountPayload {
    pub account: Account,
}

pub struct AccountAdded(pub Account);
pub struct AccountUpdated(Account);
pub struct AccountDeleted(pub Account);

impl IntoResponse for AccountAdded {
    fn write_into(self, r: &mut crate::api::response::Response) {
        r.push_addition(crate::api::response::Entity::Account(self.0));
    }
}

impl IntoResponse for AccountUpdated {
    fn write_into(self, r: &mut crate::api::response::Response) {
        r.push_update(crate::api::response::Entity::Account(self.0));
    }
}

impl IntoResponse for AccountDeleted {
    fn write_into(self, r: &mut crate::api::response::Response) {}
}

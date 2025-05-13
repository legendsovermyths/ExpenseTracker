use serde::{Deserialize, Serialize};

use crate::api::response::IntoResponse;

#[derive(Deserialize, Serialize, Debug)]
pub struct UserBalance {
    pub id: String,
    pub name: String,
    pub net_cents: i32,
}

#[derive(Deserialize, Serialize)]
pub struct UserBalancePayload {
   pub user_balances: Vec<UserBalance>,
}

pub struct UserBalancesAdded;

impl IntoResponse for UserBalancesAdded {
    fn write_into(self, r: &mut crate::api::response::Response) {}
}

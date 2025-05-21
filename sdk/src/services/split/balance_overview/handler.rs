use serde_json::Value;

use crate::api::js_handler::handle;

use super::{
    model::{UserBalancePayload, UserBalancesAdded},
    service::update_all_user_balances,
};

pub fn update_user_balances_jshandler(payload: Option<Value>) -> Value {
    handle::<UserBalancePayload, UserBalancesAdded, _>(payload, |p| {
        let _res = update_all_user_balances(p.user_balances)?;
        Ok(UserBalancesAdded)
    })
}


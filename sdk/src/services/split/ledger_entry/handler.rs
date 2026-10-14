use serde_json::Value;

use crate::api::js_handler::handle;

use super::{
    model::{LinkTransactionPayload, LinkedTransactionToLedgerEntry},
    service::link_transaction_to_ledger_entry,
};

pub fn link_transaction_to_ledger_entry_jshandler(payload: Option<Value>) -> Value {
    handle::<LinkTransactionPayload, LinkedTransactionToLedgerEntry, _>(payload, |p| {
        let _res = link_transaction_to_ledger_entry(&p.ledger_entry_id, p.transaction_id)?;
        Ok(LinkedTransactionToLedgerEntry)
    })
}

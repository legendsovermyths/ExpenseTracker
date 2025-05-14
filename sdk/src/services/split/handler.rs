use serde_json::Value;

use crate::api::js_handler::handle;

use super::{
    model::{FetchLiWithEntryPayload, FetchedLiWithEntry, UpsertSplitPayload, UpsertSplitSuccess},
    service::{fetch_friend_ledger, upsert_split_entries},
};

pub fn upsert_split_data_jshandler(payload: Option<Value>) -> Value {
    handle::<UpsertSplitPayload, UpsertSplitSuccess, _>(payload, |p| {
        let _res = upsert_split_entries(p.line_items, p.ledger_entries)?;
        Ok(UpsertSplitSuccess)
    })
}

pub fn fetch_freind_ledger_jshandler(payload: Option<Value>) -> Value {
    handle::<FetchLiWithEntryPayload, FetchedLiWithEntry, _>(payload, |p| {
        let res = fetch_friend_ledger(&p.me_id, &p.friend_id)?;
        Ok(FetchedLiWithEntry(res))
    })
}

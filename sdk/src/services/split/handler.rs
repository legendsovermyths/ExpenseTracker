use serde_json::Value;

use crate::api::js_handler::handle;

use super::{
    model::{
        DeleteSplitPayload, DeletedSplit, FetchLiWithEntryPayload,
        FetchSplitSummaryPayload, FetchedLiWithEntry, FetchedSplitSummary,
        GetDirtySplitDataPayload, GetDirtySplitDataSuccess, UpsertSplitPayload, UpsertSplitSuccess,
    },
    service::{
        add_split_entries, delete_split, fetch_friend_ledger, fetch_split_summary,
        get_dirty_split_enteries, upsert_split_entries,
    },
};

pub fn upsert_split_data_jshandler(payload: Option<Value>) -> Value {
    handle::<UpsertSplitPayload, UpsertSplitSuccess, _>(payload, |p| {
        let _res = upsert_split_entries(p.line_items, p.ledger_entries)?;
        Ok(UpsertSplitSuccess)
    })
}

pub fn get_dirty_split_data_jshandler(payload: Option<Value>) -> Value {
    handle::<GetDirtySplitDataPayload, GetDirtySplitDataSuccess, _>(payload, |_| {
        let res = get_dirty_split_enteries()?;
        Ok(GetDirtySplitDataSuccess {
            ledger_enteries: res.0,
            line_items: res.1,
        })
    })
}

pub fn insert_split_data_jshandler(payload: Option<Value>) -> Value {
    handle::<UpsertSplitPayload, UpsertSplitSuccess, _>(payload, |p| {
        let _res = add_split_entries(p.line_items, p.ledger_entries)?;
        Ok(UpsertSplitSuccess)
    })
}

pub fn fetch_freind_ledger_jshandler(payload: Option<Value>) -> Value {
    handle::<FetchLiWithEntryPayload, FetchedLiWithEntry, _>(payload, |p| {
        let res = fetch_friend_ledger(&p.me_id, &p.friend_id)?;
        Ok(FetchedLiWithEntry(res))
    })
}

pub fn fetch_split_summary_jshandler(payload: Option<Value>) -> Value {
    handle::<FetchSplitSummaryPayload, FetchedSplitSummary, _>(payload, |p| {
        let res = fetch_split_summary(&p.entry_id)?;
        Ok(FetchedSplitSummary(res))
    })
}

pub fn delete_split_jshandler(payload: Option<Value>) -> Value {
    handle::<DeleteSplitPayload, DeletedSplit, _>(payload, |p| {
        let _res = delete_split(&p.entry_id)?;
        Ok(DeletedSplit)
    })
}

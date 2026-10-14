use serde_json::Value;

use crate::api::js_handler::handle;

use super::{
    model::{
        AddFundEntryPayload, AddedFundEntry, DeleteFundEntryPayload, DeleteFundPayload,
        DeletedFund, DeletedFundEntry, FetchFundDetailPayload, FetchFundsPayload, FetchedFundDetail,
        FetchedFunds, GetDirtyFundDataPayload, GetDirtyFundDataSuccess, SyncFundDataPayload,
        SyncedFundData, UpdateFundEntryPayload, UpdatedFundEntry, UpsertFundPayload, UpsertedFund,
    },
    service::{
        add_fund_entry, delete_fund, delete_fund_entry, fetch_fund_detail, fetch_funds,
        get_dirty_fund_data, sync_fund_data, update_fund_entry, upsert_fund,
    },
};

pub fn upsert_fund_jshandler(payload: Option<Value>) -> Value {
    handle::<UpsertFundPayload, UpsertedFund, _>(payload, |p| {
        let res = upsert_fund(p.fund)?;
        Ok(UpsertedFund(res))
    })
}

pub fn delete_fund_jshandler(payload: Option<Value>) -> Value {
    handle::<DeleteFundPayload, DeletedFund, _>(payload, |p| {
        let updated_at = chrono::Utc::now().to_rfc3339();
        delete_fund(&p.fund_id, &updated_at)?;
        Ok(DeletedFund)
    })
}

pub fn fetch_funds_jshandler(payload: Option<Value>) -> Value {
    handle::<FetchFundsPayload, FetchedFunds, _>(payload, |p| {
        let res = fetch_funds(&p.user_id)?;
        Ok(FetchedFunds(res))
    })
}

pub fn fetch_fund_detail_jshandler(payload: Option<Value>) -> Value {
    handle::<FetchFundDetailPayload, FetchedFundDetail, _>(payload, |p| {
        let (fund, entries, total) = fetch_fund_detail(&p.fund_id)?;
        Ok(FetchedFundDetail {
            fund,
            entries,
            total_contributed_cents: total,
        })
    })
}

pub fn add_fund_entry_jshandler(payload: Option<Value>) -> Value {
    handle::<AddFundEntryPayload, AddedFundEntry, _>(payload, |p| {
        let res = add_fund_entry(p.entry)?;
        Ok(AddedFundEntry(res))
    })
}

pub fn update_fund_entry_jshandler(payload: Option<Value>) -> Value {
    handle::<UpdateFundEntryPayload, UpdatedFundEntry, _>(payload, |p| {
        let res = update_fund_entry(p.entry)?;
        Ok(UpdatedFundEntry(res))
    })
}

pub fn delete_fund_entry_jshandler(payload: Option<Value>) -> Value {
    handle::<DeleteFundEntryPayload, DeletedFundEntry, _>(payload, |p| {
        let updated_at = chrono::Utc::now().to_rfc3339();
        delete_fund_entry(&p.entry_id, &updated_at)?;
        Ok(DeletedFundEntry)
    })
}

pub fn get_dirty_fund_data_jshandler(payload: Option<Value>) -> Value {
    handle::<GetDirtyFundDataPayload, GetDirtyFundDataSuccess, _>(payload, |_| {
        let (funds, entries) = get_dirty_fund_data()?;
        Ok(GetDirtyFundDataSuccess { funds, entries })
    })
}

pub fn sync_fund_data_jshandler(payload: Option<Value>) -> Value {
    handle::<SyncFundDataPayload, SyncedFundData, _>(payload, |p| {
        sync_fund_data(p.funds, p.entries)?;
        Ok(SyncedFundData)
    })
}

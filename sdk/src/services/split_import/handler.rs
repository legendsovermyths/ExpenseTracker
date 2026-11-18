use serde_json::Value;

use crate::api::js_handler::handle;
use crate::services::database::DB;

use super::{
    db_utils::{
        apply_split_import, fetch_import_batch, fetch_import_batches, fetch_unlinked_splits,
        undo_import_batch,
    },
    model::{
        AppliedSplitImport, ApplySplitImportPayload, FetchImportBatchesPayload,
        FetchUnlinkedSplitsPayload, FetchedImportBatch, FetchedImportBatches,
        FetchedUnlinkedSplits, ImportBatchPayload, UndoneImportBatch,
    },
};

pub fn fetch_unlinked_splits_jshandler(payload: Option<Value>) -> Value {
    handle::<FetchUnlinkedSplitsPayload, FetchedUnlinkedSplits, _>(payload, |p| {
        let conn = DB.get_connection()?;
        let rows = fetch_unlinked_splits(
            &conn,
            &p.me_id,
            p.start_date.as_deref(),
            p.end_date.as_deref(),
        )?;
        Ok(FetchedUnlinkedSplits(rows))
    })
}

pub fn apply_split_import_jshandler(payload: Option<Value>) -> Value {
    handle::<ApplySplitImportPayload, AppliedSplitImport, _>(payload, |p| {
        let mut conn = DB.get_connection()?;
        apply_split_import(&mut conn, p)
    })
}

pub fn fetch_import_batches_jshandler(payload: Option<Value>) -> Value {
    handle::<FetchImportBatchesPayload, FetchedImportBatches, _>(payload, |_| {
        let conn = DB.get_connection()?;
        Ok(FetchedImportBatches(fetch_import_batches(&conn)?))
    })
}

pub fn fetch_import_batch_jshandler(payload: Option<Value>) -> Value {
    handle::<ImportBatchPayload, FetchedImportBatch, _>(payload, |p| {
        let conn = DB.get_connection()?;
        Ok(FetchedImportBatch(fetch_import_batch(&conn, &p.batch_id)?))
    })
}

pub fn undo_import_batch_jshandler(payload: Option<Value>) -> Value {
    handle::<ImportBatchPayload, UndoneImportBatch, _>(payload, |p| {
        let mut conn = DB.get_connection()?;
        undo_import_batch(&mut conn, &p.batch_id)
    })
}

use serde::{Deserialize, Serialize};

use crate::api::response::{Entity, IntoResponse, Response};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FundRow {
    pub id: String,
    pub name: String,
    pub icon_name: Option<String>,
    pub icon_type: Option<String>,
    pub is_shared: bool,
    pub owner_id: String,
    pub other_participant_id: Option<String>,
    pub other_participant_name: Option<String>,
    pub target_cents: Option<i64>,
    pub target_date: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub is_deleted: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FundEntryRow {
    pub id: String,
    pub fund_id: String,
    pub contributor_id: String,
    pub amount_cents: i64,
    // "CONTRIBUTION" | "WITHDRAWAL"
    pub direction: String,
    pub note: Option<String>,
    pub linked_transaction_id: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
    pub is_deleted: bool,
}

// ---- Upsert (local create/edit) ------------------------------------------
#[derive(Debug, Deserialize)]
pub struct UpsertFundPayload {
    pub fund: FundRow,
}
pub struct UpsertedFund(pub FundRow);
impl IntoResponse for UpsertedFund {
    fn write_into(self, r: &mut Response) {
        r.push_addition(Entity::Fund(self.0));
    }
}

#[derive(Debug, Deserialize)]
pub struct DeleteFundPayload {
    pub fund_id: String,
}
pub struct DeletedFund;
impl IntoResponse for DeletedFund {
    fn write_into(self, _r: &mut Response) {}
}

// ---- Fetch ----------------------------------------------------------------
#[derive(Debug, Deserialize)]
pub struct FetchFundsPayload {
    pub user_id: String,
}
pub struct FetchedFunds(pub Vec<FundRow>);
impl IntoResponse for FetchedFunds {
    fn write_into(self, r: &mut Response) {
        for f in self.0 {
            r.push_addition(Entity::Fund(f));
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct FetchFundDetailPayload {
    pub fund_id: String,
}
pub struct FetchedFundDetail {
    pub fund: FundRow,
    pub entries: Vec<FundEntryRow>,
    pub total_contributed_cents: i64,
}
impl IntoResponse for FetchedFundDetail {
    fn write_into(self, r: &mut Response) {
        r.push_addition(Entity::Fund(self.fund));
        for e in self.entries {
            r.push_addition(Entity::FundEntry(e));
        }
        r.set_count(self.total_contributed_cents);
    }
}

// ---- Entries ----------------------------------------------------------------
#[derive(Debug, Deserialize)]
pub struct AddFundEntryPayload {
    pub entry: FundEntryRow,
}
pub struct AddedFundEntry(pub FundEntryRow);
impl IntoResponse for AddedFundEntry {
    fn write_into(self, r: &mut Response) {
        r.push_addition(Entity::FundEntry(self.0));
    }
}

#[derive(Debug, Deserialize)]
pub struct UpdateFundEntryPayload {
    pub entry: FundEntryRow,
}
pub struct UpdatedFundEntry(pub FundEntryRow);
impl IntoResponse for UpdatedFundEntry {
    fn write_into(self, r: &mut Response) {
        r.push_addition(Entity::FundEntry(self.0));
    }
}

#[derive(Debug, Deserialize)]
pub struct DeleteFundEntryPayload {
    pub entry_id: String,
}
pub struct DeletedFundEntry;
impl IntoResponse for DeletedFundEntry {
    fn write_into(self, _r: &mut Response) {}
}

// ---- Sync -------------------------------------------------------------------
#[derive(Debug, Deserialize, Default)]
pub struct GetDirtyFundDataPayload {}
pub struct GetDirtyFundDataSuccess {
    pub funds: Vec<FundRow>,
    pub entries: Vec<FundEntryRow>,
}
impl IntoResponse for GetDirtyFundDataSuccess {
    fn write_into(self, r: &mut Response) {
        for f in self.funds {
            r.push_update(Entity::Fund(f));
        }
        for e in self.entries {
            r.push_update(Entity::FundEntry(e));
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct SyncFundDataPayload {
    pub funds: Vec<FundRow>,
    pub entries: Vec<FundEntryRow>,
}
pub struct SyncedFundData;
impl IntoResponse for SyncedFundData {
    fn write_into(self, _r: &mut Response) {}
}

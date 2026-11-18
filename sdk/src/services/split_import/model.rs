use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::api::response::{Entity, IntoResponse, Response};
use crate::services::{account::model::Account, category::model::Category, transaction::model::Transaction};

#[derive(Debug, Deserialize)]
pub struct FetchUnlinkedSplitsPayload {
    pub me_id: String,
    #[serde(default)]
    pub start_date: Option<String>,
    #[serde(default)]
    pub end_date: Option<String>,
}

/// A split the user owes a share of that isn't linked to a transaction yet.
#[derive(Debug, Serialize, PartialEq)]
pub struct UnlinkedSplit {
    pub entry_id: String,
    pub description: Option<String>,
    pub created_at: String,
    pub owed_cents: i64,
    pub grp_name: Option<String>,
    pub counterpart_name: Option<String>,
}

pub struct FetchedUnlinkedSplits(pub Vec<UnlinkedSplit>);

impl IntoResponse for FetchedUnlinkedSplits {
    fn write_into(self, r: &mut Response) {
        r.set_data(serde_json::to_string(&self.0).unwrap_or_else(|_| "[]".into()));
    }
}

/// A category the AI proposed. Items refer to it by `key`.
#[derive(Debug, Deserialize)]
pub struct NewImportCategory {
    pub key: String,
    pub name: String,
    #[serde(default)]
    pub parent_id: Option<u32>,
    pub icon_name: String,
    pub icon_type: String,
}

#[derive(Debug, Deserialize)]
pub struct ImportItem {
    pub entry_id: String,
    pub description: String,
    pub amount: f64,
    pub date_time: String,
    #[serde(default)]
    pub category_id: Option<u32>,
    #[serde(default)]
    pub subcategory_id: Option<u32>,
    #[serde(default)]
    pub new_category_key: Option<String>,
    #[serde(default)]
    pub confidence: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ApplySplitImportPayload {
    pub batch_id: String,
    pub account_id: u32,
    #[serde(default)]
    pub new_categories: Vec<NewImportCategory>,
    pub items: Vec<ImportItem>,
}

#[derive(Debug, Default)]
pub struct AppliedSplitImport {
    /// The batch had already been applied; nothing changed.
    pub already_applied: bool,
    pub transactions: Vec<Transaction>,
    pub categories: Vec<Category>,
    pub account: Option<Account>,
    /// Items whose split was already linked (or no longer exists).
    pub skipped: usize,
}

impl IntoResponse for AppliedSplitImport {
    fn write_into(self, r: &mut Response) {
        r.set_data(
            json!({
                "already_applied": self.already_applied,
                "imported": self.transactions.len(),
                "created_categories": self.categories.len(),
                "skipped": self.skipped,
            })
            .to_string(),
        );
        for t in self.transactions {
            r.push_addition(Entity::Transaction(t));
        }
        for c in self.categories {
            r.push_addition(Entity::Category(c));
        }
        if let Some(a) = self.account {
            r.push_update(Entity::Account(a));
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct FetchImportBatchesPayload {}

#[derive(Debug, Serialize)]
pub struct ImportBatchSummary {
    pub batch_id: String,
    pub created_at: String,
    pub account_id: u32,
    pub count: i64,
    pub total: f64,
    pub created_categories: i64,
}

pub struct FetchedImportBatches(pub Vec<ImportBatchSummary>);

impl IntoResponse for FetchedImportBatches {
    fn write_into(self, r: &mut Response) {
        r.set_data(serde_json::to_string(&self.0).unwrap_or_else(|_| "[]".into()));
    }
}

#[derive(Debug, Deserialize)]
pub struct ImportBatchPayload {
    pub batch_id: String,
}

#[derive(Debug, Serialize)]
pub struct ImportBatchItem {
    pub entry_id: String,
    pub confidence: Option<String>,
    pub is_new_category: bool,
    pub transaction: Transaction,
}

pub struct FetchedImportBatch(pub Vec<ImportBatchItem>);

impl IntoResponse for FetchedImportBatch {
    fn write_into(self, r: &mut Response) {
        r.set_data(serde_json::to_string(&self.0).unwrap_or_else(|_| "[]".into()));
    }
}

#[derive(Debug, Default, PartialEq)]
pub struct UndoneImportBatch {
    pub removed_transactions: usize,
    pub removed_categories: usize,
}

impl IntoResponse for UndoneImportBatch {
    fn write_into(self, r: &mut Response) {
        r.set_data(
            json!({
                "removed_transactions": self.removed_transactions,
                "removed_categories": self.removed_categories,
            })
            .to_string(),
        );
    }
}

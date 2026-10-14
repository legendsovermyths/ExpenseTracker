use crate::services::{
    account::model::Account,
    appconstants::model::Appconstant,
    category::model::Category,
    category_budget::model::CategoryBudget,
    fund::model::{FundEntryRow, FundRow},
    notification::model::NotificationRow,
    split::{
        balance_overview::model::UserBalance,
        ledger_entry::model::LedgerEntryRow,
        line_item::model::LineItemRow,
        model::{LiWithEntry, SplitSummary},
    },
    transaction::model::Transaction,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn push<T>(slot: &mut Option<Vec<T>>, value: T) {
    slot.get_or_insert_with(Vec::new).push(value);
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Response {
    status: Option<String>,
    message: Option<String>,
    updates: Option<ChangeSet>,
    additions: Option<ChangeSet>,
    file: Option<Vec<u8>>,
    count: Option<i64>,
}

impl Response {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn ok() -> Self {
        Self {
            status: Some("success".into()),
            ..Self::default()
        }
    }

    pub fn err(error: String) -> Self {
        Self {
            status: Some("error".into()),
            message: Some(error),
            ..Self::default()
        }
    }

    pub fn set_message(&mut self, msg: &str) {
        self.message = Some(msg.to_owned());
    }

    pub fn set_status(&mut self, status: &str) {
        self.status = Some(status.to_owned());
    }

    pub fn add_file_as_bytes(&mut self, bytes: Vec<u8>) {
        self.file = Some(bytes);
    }

    pub fn set_count(&mut self, count: i64) {
        self.count = Some(count);
    }

    pub fn push_addition(&mut self, data: Entity) {
        let cs = self.additions.get_or_insert_with(ChangeSet::default);
        match data {
            Entity::Transaction(t) => push(&mut cs.transactions, t),
            Entity::Category(c) => push(&mut cs.categories, c),
            Entity::CategoryBudget(cb) => push(&mut cs.category_budgets, cb),
            Entity::Account(a) => push(&mut cs.accounts, a),
            Entity::Appconstant(ac) => push(&mut cs.appconstants, ac),
            Entity::UserBalance(b) => push(&mut cs.user_balances, b),
            Entity::LiWithEntry(li) => push(&mut cs.li_with_entry, li),
            Entity::SplitSummary(ss) => push(&mut cs.split_summary, ss),
            Entity::LineItem(li) => push(&mut cs.line_items, li),
            Entity::LedgerEntry(le) => push(&mut cs.ledger_entries, le),
            Entity::Notification(n) => push(&mut cs.notifications, n),
            Entity::Fund(f) => push(&mut cs.funds, f),
            Entity::FundEntry(fe) => push(&mut cs.fund_entries, fe),
        }
    }

    pub fn push_update(&mut self, data: Entity) {
        let cs = self.updates.get_or_insert_with(ChangeSet::default);
        match data {
            Entity::Transaction(t) => push(&mut cs.transactions, t),
            Entity::Category(c) => push(&mut cs.categories, c),
            Entity::CategoryBudget(cb) => push(&mut cs.category_budgets, cb),
            Entity::Account(a) => push(&mut cs.accounts, a),
            Entity::Appconstant(ac) => push(&mut cs.appconstants, ac),
            Entity::UserBalance(b) => push(&mut cs.user_balances, b),
            Entity::LiWithEntry(li) => push(&mut cs.li_with_entry, li),
            Entity::SplitSummary(ss) => push(&mut cs.split_summary, ss),
            Entity::LineItem(li) => push(&mut cs.line_items, li),
            Entity::LedgerEntry(le) => push(&mut cs.ledger_entries, le),
            Entity::Notification(n) => push(&mut cs.notifications, n),
            Entity::Fund(f) => push(&mut cs.funds, f),
            Entity::FundEntry(fe) => push(&mut cs.fund_entries, fe),
        }
    }

    pub fn get_value(&self) -> Value {
        serde_json::to_value(self)
            .unwrap_or_else(|e| json!({"status":"error", "message":e.to_string()}))
    }
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct ChangeSet {
    pub transactions: Option<Vec<Transaction>>,
    pub categories: Option<Vec<Category>>,
    pub category_budgets: Option<Vec<CategoryBudget>>,
    pub accounts: Option<Vec<Account>>,
    pub appconstants: Option<Vec<Appconstant>>,
    pub user_balances: Option<Vec<UserBalance>>,
    pub li_with_entry: Option<Vec<LiWithEntry>>,
    pub split_summary: Option<Vec<SplitSummary>>,
    pub ledger_entries: Option<Vec<LedgerEntryRow>>,
    pub line_items: Option<Vec<LineItemRow>>,
    pub notifications: Option<Vec<NotificationRow>>,
    pub funds: Option<Vec<FundRow>>,
    pub fund_entries: Option<Vec<FundEntryRow>>,
}

pub enum Entity {
    Transaction(Transaction),
    Account(Account),
    Category(Category),
    CategoryBudget(CategoryBudget),
    Appconstant(Appconstant),
    UserBalance(UserBalance),
    LiWithEntry(LiWithEntry),
    SplitSummary(SplitSummary),
    LedgerEntry(LedgerEntryRow),
    LineItem(LineItemRow),
    Notification(NotificationRow),
    Fund(FundRow),
    FundEntry(FundEntryRow),
}

pub trait IntoResponse {
    fn write_into(self, r: &mut Response);
}

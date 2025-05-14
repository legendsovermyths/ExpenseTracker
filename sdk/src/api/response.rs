use crate::services::{
    account::model::Account,
    appconstants::model::Appconstant,
    category::model::Category,
    split::{balance_overview::model::UserBalance, model::LiWithEntry},
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

    pub fn push_addition(&mut self, data: Entity) {
        let cs = self.additions.get_or_insert_with(ChangeSet::default);
        match data {
            Entity::Transaction(t) => push(&mut cs.transactions, t),
            Entity::Category(c) => push(&mut cs.categories, c),
            Entity::Account(a) => push(&mut cs.accounts, a),
            Entity::Appconstant(ac) => push(&mut cs.appconstants, ac),
            Entity::UserBalance(b) => push(&mut cs.user_balances, b),
            Entity::LiWithEntry(li) => push(&mut cs.li_with_entry, li),
        }
    }

    pub fn push_update(&mut self, data: Entity) {
        let cs = self.updates.get_or_insert_with(ChangeSet::default);
        match data {
            Entity::Transaction(t) => push(&mut cs.transactions, t),
            Entity::Category(c) => push(&mut cs.categories, c),
            Entity::Account(a) => push(&mut cs.accounts, a),
            Entity::Appconstant(ac) => push(&mut cs.appconstants, ac),
            Entity::UserBalance(b) => push(&mut cs.user_balances, b),
            Entity::LiWithEntry(li) => push(&mut cs.li_with_entry, li),
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
    pub accounts: Option<Vec<Account>>,
    pub appconstants: Option<Vec<Appconstant>>,
    pub user_balances: Option<Vec<UserBalance>>,
    pub li_with_entry: Option<Vec<LiWithEntry>>,
}

pub enum Entity {
    Transaction(Transaction),
    Account(Account),
    Category(Category),
    Appconstant(Appconstant),
    UserBalance(UserBalance),
    LiWithEntry(LiWithEntry),
}

pub trait IntoResponse {
    fn write_into(self, r: &mut Response);
}

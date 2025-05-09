use crate::services::category::model::Category;
use crate::services::transaction::model::Transaction;
use crate::services::{account::model::Account, appconstants::model::Appconstant};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Serialize, Deserialize)]
pub struct Response {
    status: Option<String>,
    message: Option<String>,
    updates: Option<ChangeSet>,
    additions: Option<ChangeSet>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChangeSet {
    pub transactions: Option<Vec<Transaction>>,
    pub categories: Option<Vec<Category>>,
    pub accounts: Option<Vec<Account>>,
    pub appconstants: Option<Vec<Appconstant>>,
}

pub enum Entity {
    Transaction(Transaction),
    Account(Account),
    Category(Category),
    Appconstant(Appconstant),
}

impl Response {
    pub fn new() -> Self {
        Response {
            status: None,
            message: None,
            updates: None,
            additions: None,
        }
    }

    pub fn set_message(&mut self, message: &str) {
        self.message = Some(message.to_string());
    }

    pub fn set_status(&mut self, status: &str) {
        self.status = Some(status.to_string());
    }

    pub fn push_addition(&mut self, data: Entity) {
        if self.additions.is_none() {
            self.additions = Some(ChangeSet::new());
        }
        if let Some(additions) = &mut self.additions {
            match data {
                Entity::Transaction(transaction) => {
                    if additions.transactions.is_none() {
                        additions.transactions = Some(vec![]);
                    }
                    additions.transactions.as_mut().unwrap().push(transaction);
                }
                Entity::Category(category) => {
                    if additions.categories.is_none() {
                        additions.categories = Some(vec![]);
                    }
                    additions.categories.as_mut().unwrap().push(category);
                }
                Entity::Account(account) => {
                    if additions.accounts.is_none() {
                        additions.accounts = Some(vec![]);
                    }
                    additions.accounts.as_mut().unwrap().push(account);
                }
                Entity::Appconstant(appconstant) => {
                    if additions.appconstants.is_none() {
                        additions.appconstants = Some(vec![]);
                    }
                    additions.appconstants.as_mut().unwrap().push(appconstant);
                }
            }
        }
    }

    pub fn push_update(&mut self, data: Entity) {
        if self.updates.is_none() {
            self.updates = Some(ChangeSet::new());
        }
        if let Some(updates) = &mut self.updates {
            match data {
                Entity::Transaction(transaction) => {
                    if updates.transactions.is_none() {
                        updates.transactions = Some(vec![]);
                    }
                    updates.transactions.as_mut().unwrap().push(transaction);
                }
                Entity::Category(category) => {
                    if updates.categories.is_none() {
                        updates.categories = Some(vec![]);
                    }
                    updates.categories.as_mut().unwrap().push(category);
                }
                Entity::Account(account) => {
                    if updates.accounts.is_none() {
                        updates.accounts = Some(vec![]);
                    }
                    updates.accounts.as_mut().unwrap().push(account);
                }
                Entity::Appconstant(appconstant) => {
                    if updates.appconstants.is_none() {
                        updates.appconstants = Some(vec![]);
                    }
                    updates.appconstants.as_mut().unwrap().push(appconstant);
                }
            }
        }
    }
    pub fn get_value(&self) -> Value {
        serde_json::to_value(self)
            .unwrap_or_else(|err| json!({"status":"error", "message":err.to_string()}))
    }
}

impl ChangeSet {
    pub fn new() -> Self {
        ChangeSet {
            transactions: None,
            accounts: None,
            categories: None,
            appconstants: None,
        }
    }
}

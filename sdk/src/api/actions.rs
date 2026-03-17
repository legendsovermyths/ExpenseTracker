use serde::Deserialize;

#[derive(Debug, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum Action {
    GetTransactions,
    AddTransaction,
    AddAccount,
    DeleteAccount,
    AddCategory,
    DeleteCategory,
    UpdateCategory,
    UpdateTransaction,
    DeleteTransaction,
    AddAppconstant,
    UpdateAppconstant,
    DeleteAppconstant,
    GetData
}


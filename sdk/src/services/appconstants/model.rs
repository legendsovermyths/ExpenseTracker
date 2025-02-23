use serde::{Deserialize, Serialize};

pub struct Appconstants {
    pub appconstants: Vec<Appconstant>,
}
#[derive(Serialize, Deserialize, Debug)]
pub struct Appconstant {
    pub id: Option<u32>,
    pub key: String,
    pub value: String,
}

pub struct AppconstantPayload {
    appconstant: Appconstant,
}

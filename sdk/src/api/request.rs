use serde::Deserialize;
use super::actions::Action;


#[derive(Debug, Deserialize)]
pub struct Request {
    pub action: Action,
    pub payload: Option<serde_json::Value>,
}

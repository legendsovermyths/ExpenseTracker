use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize)]
pub struct FilePayload{
    pub file: Vec<u8>
}

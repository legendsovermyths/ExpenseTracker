use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize)]
pub struct FilePayload {
    // base64-encoded .exp archive
    pub file: String,
}

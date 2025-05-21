use thiserror::Error;
use serde_json::Value;
#[derive(Debug, Error)]
pub enum ApiError {
    #[error("payload is missing")]
    PayloadMissing,
    #[error("failed to parse payload: {0}")]
    Deserailize(serde_json::Error),
}

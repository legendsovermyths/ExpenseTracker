use serde::{Deserialize, Serialize};

use crate::api::response::{Entity, IntoResponse, Response};

pub const OWNER_TRANSACTION: &str = "TRANSACTION";
pub const OWNER_SPLIT: &str = "SPLIT";

pub const DOC_TYPES: [&str; 5] = ["BILL", "INVOICE", "RECEIPT", "WARRANTY", "OTHER"];

/// Lightweight attachment metadata. Never carries the file content.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AttachmentRow {
    pub id: String,
    pub owner_type: String,
    pub owner_id: String,
    pub file_name: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub doc_type: Option<String>,
    pub doc_type_source: Option<String>,
    pub thumbnail_b64: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct NewAttachment {
    #[serde(flatten)]
    pub meta: AttachmentRow,
    pub data_b64: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AttachmentOwner {
    pub owner_type: String,
    pub owner_id: String,
}

/// One row on the Documents screen: a transaction or split that has files.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DocumentedItem {
    pub owner_type: String,
    pub owner_id: String,
    pub description: Option<String>,
    pub amount: f64,
    pub is_credit: bool,
    pub date_time: String,
    pub category_id: Option<i64>,
    pub counterparty_id: Option<String>,
    pub counterparty_name: Option<String>,
    pub attachment_count: i64,
    pub doc_types: Vec<String>,
    pub thumbnail_b64: Option<String>,
}

// ---- payloads / responses ---------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct AddAttachmentsPayload {
    pub owner_type: String,
    pub owner_id: String,
    pub attachments: Vec<NewAttachment>,
}
pub struct AddedAttachments(pub Vec<AttachmentRow>);
impl IntoResponse for AddedAttachments {
    fn write_into(self, r: &mut Response) {
        for a in self.0 {
            r.push_addition(Entity::Attachment(a));
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct ListAttachmentsPayload {
    pub owner_type: String,
    pub owner_id: String,
}
pub struct ListedAttachments(pub Vec<AttachmentRow>);
impl IntoResponse for ListedAttachments {
    fn write_into(self, r: &mut Response) {
        for a in self.0 {
            r.push_addition(Entity::Attachment(a));
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct GetAttachmentDataPayload {
    pub attachment_id: String,
}
pub struct AttachmentData(pub String);
impl IntoResponse for AttachmentData {
    fn write_into(self, r: &mut Response) {
        r.set_data(self.0);
    }
}

#[derive(Debug, Deserialize)]
pub struct UpdateAttachmentTypePayload {
    pub attachment_id: String,
    pub doc_type: Option<String>,
    pub source: Option<String>,
}
pub struct UpdatedAttachment(pub AttachmentRow);
impl IntoResponse for UpdatedAttachment {
    fn write_into(self, r: &mut Response) {
        r.push_update(Entity::Attachment(self.0));
    }
}

#[derive(Debug, Deserialize)]
pub struct DeleteAttachmentsPayload {
    pub attachment_ids: Vec<String>,
}
pub struct DeletedAttachments;
impl IntoResponse for DeletedAttachments {
    fn write_into(self, _r: &mut Response) {}
}

#[derive(Debug, Deserialize, Default)]
pub struct ListAttachmentOwnersPayload {}
pub struct ListedAttachmentOwners(pub Vec<AttachmentOwner>);
impl IntoResponse for ListedAttachmentOwners {
    fn write_into(self, r: &mut Response) {
        for o in self.0 {
            r.push_addition(Entity::AttachmentOwner(o));
        }
    }
}

#[derive(Debug, Deserialize, Default)]
pub struct ListDocumentedItemsPayload {
    /// Filter by doc type; "UNCLASSIFIED" matches attachments with no type.
    pub doc_type: Option<String>,
    /// Current user id — used to resolve the other person on splits.
    pub me_id: Option<String>,
}
pub struct ListedDocumentedItems(pub Vec<DocumentedItem>);
impl IntoResponse for ListedDocumentedItems {
    fn write_into(self, r: &mut Response) {
        for d in self.0 {
            r.push_addition(Entity::DocumentedItem(d));
        }
    }
}

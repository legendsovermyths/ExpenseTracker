use serde_json::Value;

use crate::api::js_handler::handle;

use super::{
    model::{
        AddAttachmentsPayload, AddedAttachments, AttachmentData, DeleteAttachmentsPayload,
        DeletedAttachments, GetAttachmentDataPayload, ListAttachmentOwnersPayload,
        ListAttachmentsPayload, ListDocumentedItemsPayload, ListedAttachmentOwners,
        ListedAttachments, ListedDocumentedItems, UpdateAttachmentTypePayload, UpdatedAttachment,
    },
    service::{
        add_attachments, delete_attachments, get_attachment_data, list_attachment_owners,
        list_attachments, list_documented_items, update_attachment_type,
    },
};

pub fn add_attachments_jshandler(payload: Option<Value>) -> Value {
    handle::<AddAttachmentsPayload, AddedAttachments, _>(payload, |p| {
        Ok(AddedAttachments(add_attachments(
            &p.owner_type,
            &p.owner_id,
            p.attachments,
        )?))
    })
}

pub fn list_attachments_jshandler(payload: Option<Value>) -> Value {
    handle::<ListAttachmentsPayload, ListedAttachments, _>(payload, |p| {
        Ok(ListedAttachments(list_attachments(&p.owner_type, &p.owner_id)?))
    })
}

pub fn get_attachment_data_jshandler(payload: Option<Value>) -> Value {
    handle::<GetAttachmentDataPayload, AttachmentData, _>(payload, |p| {
        Ok(AttachmentData(get_attachment_data(&p.attachment_id)?))
    })
}

pub fn update_attachment_type_jshandler(payload: Option<Value>) -> Value {
    handle::<UpdateAttachmentTypePayload, UpdatedAttachment, _>(payload, |p| {
        Ok(UpdatedAttachment(update_attachment_type(
            &p.attachment_id,
            p.doc_type.as_deref(),
            p.source.as_deref(),
        )?))
    })
}

pub fn delete_attachments_jshandler(payload: Option<Value>) -> Value {
    handle::<DeleteAttachmentsPayload, DeletedAttachments, _>(payload, |p| {
        delete_attachments(&p.attachment_ids)?;
        Ok(DeletedAttachments)
    })
}

pub fn list_attachment_owners_jshandler(payload: Option<Value>) -> Value {
    handle::<ListAttachmentOwnersPayload, ListedAttachmentOwners, _>(payload, |_p| {
        Ok(ListedAttachmentOwners(list_attachment_owners()?))
    })
}

pub fn list_documented_items_jshandler(payload: Option<Value>) -> Value {
    handle::<ListDocumentedItemsPayload, ListedDocumentedItems, _>(payload, |p| {
        Ok(ListedDocumentedItems(list_documented_items(
            p.doc_type.as_deref(),
            p.me_id.as_deref(),
        )?))
    })
}

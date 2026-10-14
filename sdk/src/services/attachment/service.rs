use std::error::Error;

use super::{
    db_utils::{
        delete_attachments_from_database, get_attachment_data_from_database,
        get_attachment_from_database, insert_attachments_in_database,
        list_attachment_owners_from_database, list_attachments_from_database,
        list_documented_items_from_database, update_attachment_type_in_database,
    },
    model::{
        AttachmentOwner, AttachmentRow, DocumentedItem, NewAttachment, DOC_TYPES, OWNER_SPLIT,
        OWNER_TRANSACTION,
    },
};

fn validate_owner_type(owner_type: &str) -> Result<(), Box<dyn Error>> {
    if owner_type == OWNER_TRANSACTION || owner_type == OWNER_SPLIT {
        Ok(())
    } else {
        Err(format!("invalid attachment owner type: {}", owner_type).into())
    }
}

fn validate_doc_type(doc_type: Option<&str>) -> Result<(), Box<dyn Error>> {
    match doc_type {
        None => Ok(()),
        Some(t) if DOC_TYPES.contains(&t) => Ok(()),
        Some(t) => Err(format!("invalid document type: {}", t).into()),
    }
}

pub fn add_attachments(
    owner_type: &str,
    owner_id: &str,
    mut attachments: Vec<NewAttachment>,
) -> Result<Vec<AttachmentRow>, Box<dyn Error>> {
    validate_owner_type(owner_type)?;
    for a in attachments.iter_mut() {
        validate_doc_type(a.meta.doc_type.as_deref())?;
        // The owner given at the top level is authoritative.
        a.meta.owner_type = owner_type.to_string();
        a.meta.owner_id = owner_id.to_string();
    }
    insert_attachments_in_database(attachments)
}

pub fn list_attachments(
    owner_type: &str,
    owner_id: &str,
) -> Result<Vec<AttachmentRow>, Box<dyn Error>> {
    validate_owner_type(owner_type)?;
    list_attachments_from_database(owner_type, owner_id)
}

pub fn get_attachment_data(id: &str) -> Result<String, Box<dyn Error>> {
    get_attachment_data_from_database(id)
}

pub fn update_attachment_type(
    id: &str,
    doc_type: Option<&str>,
    source: Option<&str>,
) -> Result<AttachmentRow, Box<dyn Error>> {
    validate_doc_type(doc_type)?;
    update_attachment_type_in_database(id, doc_type, source)?;
    get_attachment_from_database(id)
}

pub fn delete_attachments(ids: &[String]) -> Result<(), Box<dyn Error>> {
    delete_attachments_from_database(ids)
}

pub fn list_attachment_owners() -> Result<Vec<AttachmentOwner>, Box<dyn Error>> {
    list_attachment_owners_from_database()
}

pub fn list_documented_items(
    doc_type: Option<&str>,
    me_id: Option<&str>,
) -> Result<Vec<DocumentedItem>, Box<dyn Error>> {
    list_documented_items_from_database(doc_type, me_id)
}

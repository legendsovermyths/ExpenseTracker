use base64::Engine;
use serde_json::Value;

use crate::api::js_handler::handle;

use super::{
    db_utils::{
        get_dirty_icons_from_database, get_icons_from_database, insert_icon_in_database,
        is_valid_path, is_valid_prompt, soft_delete_icon_in_database, sync_icons_in_database,
    },
    model::{
        DeleteIconPayload, DeletedIcon, DirtyIcons, FetchIconsPayload, FetchedIcons,
        GetDirtyIconsPayload, SaveIconPayload, SavedIcon, SyncIconsPayload, SyncedIcons,
        VectorizeIconPayload, VectorizedIcon,
    },
    vectorize::vectorize,
};

const MAX_IMAGE_B64: usize = 12 * 1024 * 1024;

fn is_valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

pub fn vectorize_icon_jshandler(payload: Option<Value>) -> Value {
    handle::<VectorizeIconPayload, VectorizedIcon, _>(payload, |p| {
        if p.image_b64.len() > MAX_IMAGE_B64 {
            return Err("The generated image is too large".into());
        }
        let raw = p.image_b64.trim();
        let raw = raw.split_once("base64,").map_or(raw, |(_, b)| b);
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(raw.replace(['\n', '\r'], ""))
            .map_err(|_| "Couldn't read the generated image")?;
        Ok(VectorizedIcon(vectorize(&bytes)?.path))
    })
}

pub fn save_icon_jshandler(payload: Option<Value>) -> Value {
    handle::<SaveIconPayload, SavedIcon, _>(payload, |p| {
        let i = &p.icon;
        if !is_valid_id(&i.id) || !is_valid_id(&i.owner_id) {
            return Err("Invalid icon id".into());
        }
        if !is_valid_path(&i.path) {
            return Err("Invalid icon shape".into());
        }
        if !is_valid_prompt(&i.prompt) {
            return Err("Icon description is too long".into());
        }
        Ok(SavedIcon(insert_icon_in_database(i)?))
    })
}

pub fn fetch_icons_jshandler(payload: Option<Value>) -> Value {
    handle::<FetchIconsPayload, FetchedIcons, _>(payload, |_| Ok(FetchedIcons(get_icons_from_database()?)))
}

pub fn delete_icon_jshandler(payload: Option<Value>) -> Value {
    handle::<DeleteIconPayload, DeletedIcon, _>(payload, |p| {
        soft_delete_icon_in_database(&p.id, &chrono::Utc::now().to_rfc3339())?;
        Ok(DeletedIcon)
    })
}

pub fn get_dirty_icons_jshandler(payload: Option<Value>) -> Value {
    handle::<GetDirtyIconsPayload, DirtyIcons, _>(payload, |_| Ok(DirtyIcons(get_dirty_icons_from_database()?)))
}

pub fn sync_icons_jshandler(payload: Option<Value>) -> Value {
    handle::<SyncIconsPayload, SyncedIcons, _>(payload, |p| {
        sync_icons_in_database(&p.icons, &p.pushed)?;
        Ok(SyncedIcons)
    })
}

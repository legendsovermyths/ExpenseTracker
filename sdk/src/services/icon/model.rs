use serde::{Deserialize, Serialize};

use crate::api::response::{Entity, IntoResponse, Response};

/// A generated icon. `path` is SVG path data on a 0 0 24 24 grid, rendered
/// with fill-rule evenodd. Mirrors `public.icon` in Supabase.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct IconRow {
    pub id: String,
    pub owner_id: String,
    pub path: String,
    #[serde(default)]
    pub prompt: Option<String>,
    pub created_at: String,
    #[serde(default)]
    pub updated_at: Option<String>,
    #[serde(default)]
    pub is_deleted: bool,
}

#[derive(Debug, Deserialize)]
pub struct VectorizeIconPayload {
    pub image_b64: String,
}
pub struct VectorizedIcon(pub String);
impl IntoResponse for VectorizedIcon {
    fn write_into(self, r: &mut Response) {
        r.set_data(self.0);
    }
}

#[derive(Debug, Deserialize)]
pub struct SaveIconPayload {
    pub icon: IconRow,
}
pub struct SavedIcon(pub IconRow);
impl IntoResponse for SavedIcon {
    fn write_into(self, r: &mut Response) {
        r.push_addition(Entity::Icon(self.0));
    }
}

#[derive(Debug, Deserialize, Default)]
pub struct FetchIconsPayload {}
pub struct FetchedIcons(pub Vec<IconRow>);
impl IntoResponse for FetchedIcons {
    fn write_into(self, r: &mut Response) {
        for i in self.0 {
            r.push_addition(Entity::Icon(i));
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct DeleteIconPayload {
    pub id: String,
}
pub struct DeletedIcon;
impl IntoResponse for DeletedIcon {
    fn write_into(self, _r: &mut Response) {}
}

#[derive(Debug, Deserialize, Default)]
pub struct GetDirtyIconsPayload {}
pub struct DirtyIcons(pub Vec<IconRow>);
impl IntoResponse for DirtyIcons {
    fn write_into(self, r: &mut Response) {
        for i in self.0 {
            r.push_update(Entity::Icon(i));
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct SyncIconsPayload {
    /// Rows pulled from Supabase.
    #[serde(default)]
    pub icons: Vec<IconRow>,
    /// Local rows Supabase accepted, as they were when pushed. The dirty flag
    /// is only cleared if the row hasn't changed since (e.g. deleted while
    /// the push was in flight), so that change still goes out next time.
    #[serde(default)]
    pub pushed: Vec<PushedIcon>,
}

#[derive(Debug, Deserialize)]
pub struct PushedIcon {
    pub id: String,
    #[serde(default)]
    pub updated_at: Option<String>,
}
pub struct SyncedIcons;
impl IntoResponse for SyncedIcons {
    fn write_into(self, _r: &mut Response) {}
}

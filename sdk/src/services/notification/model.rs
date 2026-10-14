use serde::{Deserialize, Serialize};

use crate::api::response::{Entity, IntoResponse, Response};

// Mirrors the Supabase `notifications` row shape 1:1 — this table is both
// the sync payload and the local read cache (same pattern as `ledger_entry`/
// `line_item`), except notifications flow one-way: server -> client. The
// client never creates a notification row itself, only mirrors and marks
// `read_at`.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NotificationRow {
    pub id: String,
    pub user_id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub actor_id: String,
    // Kept as a JSON string end-to-end rather than a typed struct — the set
    // of notification `kind`s (and their payload shape) will grow over time
    // (splits today, kitty contributions next) and shouldn't require a
    // schema/model change on this side for every addition.
    pub payload: String,
    pub created_at: String,
    pub read_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SyncNotificationsPayload {
    pub notifications: Vec<NotificationRow>,
}

pub struct SyncedNotifications;
impl IntoResponse for SyncedNotifications {
    fn write_into(self, _r: &mut Response) {}
}

#[derive(Debug, Deserialize, Default)]
pub struct GetNotificationsPayload {
    pub limit: Option<i64>,
}

pub struct FetchedNotifications(pub Vec<NotificationRow>);
impl IntoResponse for FetchedNotifications {
    fn write_into(self, r: &mut Response) {
        for n in self.0 {
            r.push_addition(Entity::Notification(n));
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct MarkNotificationReadPayload {
    pub id: String,
    pub read_at: String,
}

pub struct MarkedNotificationRead;
impl IntoResponse for MarkedNotificationRead {
    fn write_into(self, _r: &mut Response) {}
}

#[derive(Debug, Deserialize, Default)]
pub struct GetUnreadNotificationCountPayload {}

pub struct UnreadNotificationCount(pub i64);
impl IntoResponse for UnreadNotificationCount {
    fn write_into(self, r: &mut Response) {
        r.set_count(self.0);
    }
}

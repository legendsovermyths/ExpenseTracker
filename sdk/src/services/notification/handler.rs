use serde_json::Value;

use crate::api::js_handler::handle;

use super::{
    model::{
        FetchedNotifications, GetNotificationsPayload, GetUnreadNotificationCountPayload,
        MarkNotificationReadPayload, MarkedNotificationRead, SyncNotificationsPayload,
        SyncedNotifications, UnreadNotificationCount,
    },
    service::{
        get_notifications, get_unread_notification_count, mark_notification_read,
        sync_notifications,
    },
};

pub fn sync_notifications_jshandler(payload: Option<Value>) -> Value {
    handle::<SyncNotificationsPayload, SyncedNotifications, _>(payload, |p| {
        sync_notifications(p.notifications)?;
        Ok(SyncedNotifications)
    })
}

pub fn get_notifications_jshandler(payload: Option<Value>) -> Value {
    handle::<GetNotificationsPayload, FetchedNotifications, _>(payload, |p| {
        let res = get_notifications(p.limit)?;
        Ok(FetchedNotifications(res))
    })
}

pub fn mark_notification_read_jshandler(payload: Option<Value>) -> Value {
    handle::<MarkNotificationReadPayload, MarkedNotificationRead, _>(payload, |p| {
        mark_notification_read(&p.id, &p.read_at)?;
        Ok(MarkedNotificationRead)
    })
}

pub fn get_unread_notification_count_jshandler(payload: Option<Value>) -> Value {
    handle::<GetUnreadNotificationCountPayload, UnreadNotificationCount, _>(payload, |_| {
        let count = get_unread_notification_count()?;
        Ok(UnreadNotificationCount(count))
    })
}

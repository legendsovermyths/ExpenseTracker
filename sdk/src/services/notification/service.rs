use std::error::Error;

use super::{
    db_utils::{
        get_notifications_from_database, get_unread_notification_count_from_database,
        mark_notification_read_in_database, upsert_notifications_in_database,
    },
    model::NotificationRow,
};

pub fn sync_notifications(rows: Vec<NotificationRow>) -> Result<(), Box<dyn Error>> {
    upsert_notifications_in_database(rows)
}

pub fn get_notifications(limit: Option<i64>) -> Result<Vec<NotificationRow>, Box<dyn Error>> {
    get_notifications_from_database(limit)
}

pub fn mark_notification_read(id: &str, read_at: &str) -> Result<(), Box<dyn Error>> {
    mark_notification_read_in_database(id, read_at)
}

pub fn get_unread_notification_count() -> Result<i64, Box<dyn Error>> {
    get_unread_notification_count_from_database()
}

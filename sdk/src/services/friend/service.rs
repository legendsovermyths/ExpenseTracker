use super::{
    db_utils::{delete_friend_from_database, get_all_friends_from_database, upsert_friend_in_database},
    model::Friend,
};
use std::error::Error;

pub fn add_friend(friend: Friend) -> Result<Friend, Box<dyn Error>> {
    if friend.id.trim().is_empty() {
        return Err("Friend id cannot be empty".into());
    }
    Ok(upsert_friend_in_database(friend)?)
}

pub fn delete_friend(friend_id: String) -> Result<(), Box<dyn Error>> {
    delete_friend_from_database(&friend_id)?;
    Ok(())
}

pub fn get_all_friends() -> Result<Vec<Friend>, Box<dyn Error>> {
    Ok(get_all_friends_from_database()?)
}

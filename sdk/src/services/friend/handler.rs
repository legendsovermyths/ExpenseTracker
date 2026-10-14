use super::{
    model::{AddFriendPayload, DeleteFriendPayload, FriendAdded, FriendDeleted},
    service::{add_friend, delete_friend},
};
use crate::api::js_handler::handle;
use serde_json::Value;

pub fn add_friend_jshandler(payload: Option<Value>) -> Value {
    handle::<AddFriendPayload, FriendAdded, _>(payload, |p| Ok(FriendAdded(add_friend(p.friend)?)))
}

pub fn delete_friend_jshandler(payload: Option<Value>) -> Value {
    handle::<DeleteFriendPayload, FriendDeleted, _>(payload, |p| {
        delete_friend(p.friend_id)?;
        Ok(FriendDeleted)
    })
}

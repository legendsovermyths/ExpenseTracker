use serde::{Deserialize, Serialize};

use crate::api::response::{Entity, IntoResponse, Response};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Friend {
    pub id: String,
    pub name: String,
    pub added_at: String,
}

#[derive(Debug, Deserialize)]
pub struct AddFriendPayload {
    pub friend: Friend,
}

#[derive(Debug, Deserialize)]
pub struct DeleteFriendPayload {
    pub friend_id: String,
}

pub struct FriendAdded(pub Friend);
pub struct FriendDeleted;

impl IntoResponse for FriendAdded {
    fn write_into(self, r: &mut Response) {
        r.push_addition(Entity::Friend(self.0));
    }
}

impl IntoResponse for FriendDeleted {
    fn write_into(self, _r: &mut Response) {}
}

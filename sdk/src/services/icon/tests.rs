// Run with an isolated HOME, e.g. `HOME=$(mktemp -d) cargo test`, because the
// database lives at $HOME/Documents/expensify.db.
use base64::Engine;
use serde_json::{json, Value};

use crate::api::actions::Action;
use crate::api::js_handler::JsHandler;
use crate::services::database::DB;

fn call(action: Action, payload: Value) -> Value {
    JsHandler::get_js_handler().execute_action(action, Some(payload))
}

fn ok(action: Action, payload: Value) -> Value {
    let res = call(action, payload);
    assert_eq!(res["status"], "success", "{res:?}");
    res
}

fn icon(id: &str, owner: &str, path: &str) -> Value {
    json!({ "id": id, "owner_id": owner, "path": path, "prompt": "cup",
            "created_at": format!("2026-10-18T10:00:0{}Z", id.len() % 10) })
}

fn icons() -> Vec<Value> {
    ok(Action::FetchIcons, json!({}))["additions"]["icons"]
        .as_array()
        .cloned()
        .unwrap_or_default()
}

fn find(id: &str) -> Option<Value> {
    icons().into_iter().find(|i| i["id"] == id)
}

fn dirty_ids() -> Vec<String> {
    ok(Action::GetDirtyIcons, json!({}))["updates"]["icons"]
        .as_array()
        .map(|a| a.iter().map(|i| i["id"].as_str().unwrap().to_string()).collect())
        .unwrap_or_default()
}

#[test]
fn icon_store_lifecycle() {
    std::fs::create_dir_all(format!("{}/Documents", std::env::var("HOME").unwrap())).unwrap();
    DB.get_connection().unwrap().execute_batch("DELETE FROM custom_icons;").unwrap();

    // Vectorize the real FLUX output through the JS bridge.
    let jpeg = include_bytes!("../../../tests/fixtures/coffee-cup.jpg");
    let b64 = base64::engine::general_purpose::STANDARD.encode(jpeg);
    let res = ok(Action::VectorizeIcon, json!({ "image_b64": b64 }));
    let path = res["data"].as_str().unwrap().to_string();
    assert!(path.starts_with('M') && path.ends_with('Z'));
    // A data: URL prefix and line breaks are tolerated.
    let wrapped = format!("data:image/jpeg;base64,{}", b64.as_bytes().chunks(76).map(|c| std::str::from_utf8(c).unwrap()).collect::<Vec<_>>().join("\n"));
    assert_eq!(ok(Action::VectorizeIcon, json!({ "image_b64": wrapped }))["data"], path);

    // Bad images come back as readable errors, not crashes.
    let bad = call(Action::VectorizeIcon, json!({ "image_b64": "%%%" }));
    assert_eq!(bad["status"], "error");
    let blank = call(Action::VectorizeIcon, json!({ "image_b64": base64::engine::general_purpose::STANDARD.encode(b"not an image") }));
    assert_eq!(blank["status"], "error");
    assert!(blank["message"].as_str().unwrap().contains("Couldn't read"));

    // Save: new icons are dirty until pushed.
    let saved = ok(Action::SaveIcon, json!({ "icon": icon("icon-a", "me", &path) }));
    assert_eq!(saved["additions"]["icons"][0]["id"], "icon-a");
    assert_eq!(dirty_ids(), vec!["icon-a"]);

    // Saving again (retry) is idempotent and can't swap the shape.
    ok(Action::SaveIcon, json!({ "icon": icon("icon-a", "me", "M0 0L1 1Z") }));
    assert_eq!(find("icon-a").unwrap()["path"], path);
    assert_eq!(icons().len(), 1);

    // Validation mirrors the Supabase CHECK.
    for (label, row) in [
        ("markup", icon("icon-x", "me", "<svg/>")),
        ("no move", icon("icon-x", "me", "L1 1Z")),
        ("too long", icon("icon-x", "me", &format!("M0 0{}", " L1 1".repeat(4000)))),
        ("bad id", icon("../etc", "me", "M0 0Z")),
        ("long prompt", json!({ "id": "icon-x", "owner_id": "me", "path": "M0 0Z", "prompt": "x".repeat(61), "created_at": "2026" })),
    ] {
        assert_eq!(call(Action::SaveIcon, json!({ "icon": row }))["status"], "error", "{label}");
    }
    assert!(find("icon-x").is_none());

    // Push succeeded → clean. Pull brings a friend's icon from a shared group.
    let friend = icon("icon-b", "friend", "M2 2L22 2L22 22L2 22Z");
    let mut pulled_a = icon("icon-a", "me", &path);
    pulled_a["updated_at"] = json!("2026-10-18T10:05:00Z");
    let pushed_a = find("icon-a").unwrap();
    ok(Action::SyncIcons, json!({ "icons": [pulled_a, friend],
        "pushed": [{ "id": "icon-a", "updated_at": pushed_a["updated_at"] }] }));
    assert!(dirty_ids().is_empty());
    assert_eq!(find("icon-b").unwrap()["owner_id"], "friend");
    assert_eq!(find("icon-a").unwrap()["updated_at"], "2026-10-18T10:05:00Z");

    // Malformed server rows are skipped, the rest of the batch still applies.
    let evil = icon("icon-evil", "friend", "<script>");
    let good = icon("icon-c", "friend", "M1 1L2 2Z");
    ok(Action::SyncIcons, json!({ "icons": [evil, good] }));
    assert!(find("icon-evil").is_none());
    assert!(find("icon-c").is_some());

    // Delete is soft and dirty; a stale server copy doesn't undo it.
    let before_delete = find("icon-a").unwrap()["updated_at"].clone();
    ok(Action::DeleteIcon, json!({ "id": "icon-a" }));
    assert_eq!(find("icon-a").unwrap()["is_deleted"], true);
    assert_eq!(dirty_ids(), vec!["icon-a"]);
    ok(Action::SyncIcons, json!({ "icons": [icon("icon-a", "me", &path)] }));
    assert_eq!(find("icon-a").unwrap()["is_deleted"], true);

    // A push that started before the delete finishes after it: its ack is
    // for the old version, so the delete stays queued.
    ok(Action::SyncIcons, json!({ "pushed": [{ "id": "icon-a", "updated_at": before_delete }] }));
    assert_eq!(dirty_ids(), vec!["icon-a"]);
    let deleted = find("icon-a").unwrap();
    ok(Action::SyncIcons, json!({ "pushed": [{ "id": "icon-a", "updated_at": deleted["updated_at"] }] }));
    assert!(dirty_ids().is_empty());
}

#[test]
fn groups_carry_their_icon() {
    std::fs::create_dir_all(format!("{}/Documents", std::env::var("HOME").unwrap())).unwrap();
    let group = |icon_type: Value, icon_name: Value| json!({
        "group": { "id": "grp-icon", "name": "Surf", "created_by": "me", "created_at": "2026-10-18T10:00:00Z",
                   "updated_at": "2026-10-18T10:00:00Z", "is_deleted": false,
                   "icon_type": icon_type, "icon_name": icon_name },
        "members": [{ "grp_id": "grp-icon", "user_id": "me", "user_name": "Me",
                      "joined_at": "2026-10-18T10:00:00Z", "updated_at": "2026-10-18T10:00:00Z", "is_deleted": false }],
    });
    ok(Action::UpsertGroup, group(json!("custom"), json!("icon-b")));
    let fetched = ok(Action::FetchGroups, json!({ "user_id": "me" }));
    let g = fetched["additions"]["group_summaries"].as_array().unwrap().iter()
        .find(|s| s["group"]["id"] == "grp-icon").unwrap().clone();
    assert_eq!(g["group"]["icon_type"], "custom");
    assert_eq!(g["group"]["icon_name"], "icon-b");

    let dirty = ok(Action::GetDirtyGroupData, json!({}));
    assert!(dirty["updates"]["groups"].as_array().unwrap().iter().any(|r| r["icon_name"] == "icon-b"));

    // Older payloads without icon fields still parse (no icon).
    ok(Action::SyncGroupData, json!({ "groups": [{ "id": "grp-old", "name": "Old", "created_by": "x",
        "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z" }], "members": [] }));
    let detail = ok(Action::FetchGroupDetail, json!({ "grp_id": "grp-old", "me_id": "me" }));
    assert!(detail["additions"]["group_details"][0]["group"]["icon_type"].is_null());
}

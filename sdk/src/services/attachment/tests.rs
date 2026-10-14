// Run with an isolated HOME, e.g. `HOME=$(mktemp -d) cargo test`, because the
// database lives at $HOME/Documents/expensify.db.
use rusqlite::params;
use serde_json::{json, Value};

use crate::api::js_handler::JsHandler;
use crate::api::actions::Action;
use crate::services::database::DB;

fn call(action: Action, payload: Value) -> Value {
    let res = JsHandler::get_js_handler().execute_action(action, Some(payload));
    assert_ne!(res["status"], "error", "{:?}", res);
    res
}

fn meta(id: &str, doc_type: Option<&str>, thumb: Option<&str>) -> Value {
    json!({
        "id": id, "owner_type": "", "owner_id": "", "file_name": format!("{id}.jpg"),
        "mime_type": "image/jpeg", "size_bytes": 3, "doc_type": doc_type,
        "doc_type_source": null, "thumbnail_b64": thumb,
        "created_at": format!("2026-10-14T00:00:0{}Z", id.len() % 10),
        "data_b64": format!("DATA-{id}"),
    })
}

#[test]
fn attachment_lifecycle() {
    std::fs::create_dir_all(format!("{}/Documents", std::env::var("HOME").unwrap())).unwrap();
    let txn_id: i64 = {
        let conn = DB.get_connection().unwrap();
        conn.execute_batch(
            "DELETE FROM attachment_blob; DELETE FROM attachment; DELETE FROM ledger_entry;
             DELETE FROM line_item; DELETE FROM transactions; DELETE FROM balance_overview;",
        )
        .unwrap();
        conn.execute_batch(
            "INSERT INTO accounts (name, amount) VALUES ('Bank', 0);
             INSERT INTO categories (name, is_subcategory) VALUES ('Shopping', 0);",
        )
        .unwrap();
        let account_id = conn.query_row("SELECT MAX(id) FROM accounts", [], |r| r.get::<_, i64>(0)).unwrap();
        let category_id = conn.query_row("SELECT MAX(id) FROM categories", [], |r| r.get::<_, i64>(0)).unwrap();
        conn.execute(
            "INSERT INTO transactions (description, amount, date_time, is_credit, account_id, category_id)
             VALUES ('Laptop', 90000, '2026-10-10T10:00:00Z', 0, ?1, ?2);",
            params![account_id, category_id],
        )
        .unwrap();
        let id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO ledger_entry (id, kind, description, created_by, created_at, total_cents, updated_at, transaction_id, is_deleted, is_dirty)
             VALUES ('split-1', 'SPLIT', 'Dinner', 'me', '2026-10-12T10:00:00Z', 200000, '', ?1, 0, 0);",
            params![id],
        )
        .unwrap();
        conn.execute_batch(
            "INSERT INTO line_item (entry_id, user_id, amount_cents, paid_cents, owed_cents) VALUES
               ('split-1', 'me', 0, 0, 0), ('split-1', 'friend', 0, 0, 0);
             INSERT INTO balance_overview (friend_id, friend_name, net_cents) VALUES ('friend', 'Rahul', 0);",
        )
        .unwrap();
        id
    };
    let txn = txn_id.to_string();

    // Owner from the payload wins over whatever the meta rows say.
    let added = call(
        Action::AddAttachments,
        json!({"owner_type": "TRANSACTION", "owner_id": txn,
               "attachments": [meta("a1", Some("WARRANTY"), Some("T1")), meta("a22", None, None)]}),
    );
    assert_eq!(added["additions"]["attachments"][0]["owner_id"], txn);
    assert!(added["additions"]["attachments"][0].get("data_b64").is_none());
    call(
        Action::AddAttachments,
        json!({"owner_type": "SPLIT", "owner_id": "split-1",
               "attachments": [meta("b333", Some("BILL"), Some("T2"))]}),
    );

    // Linked pairs see each other's files.
    let txn_list = call(Action::ListAttachments, json!({"owner_type": "TRANSACTION", "owner_id": txn}));
    assert_eq!(txn_list["additions"]["attachments"].as_array().unwrap().len(), 3);
    let split_list = call(Action::ListAttachments, json!({"owner_type": "SPLIT", "owner_id": "split-1"}));
    assert_eq!(split_list["additions"]["attachments"].as_array().unwrap().len(), 3);
    assert!(txn_list["additions"]["attachments"][0]["thumbnail_b64"].is_string());

    let owners = call(Action::ListAttachmentOwners, json!({}));
    assert_eq!(owners["additions"]["attachment_owners"].as_array().unwrap().len(), 2);

    let data = call(Action::GetAttachmentData, json!({"attachment_id": "a22"}));
    assert_eq!(data["data"], "DATA-a22");

    // Documents listing + filters.
    let all = call(Action::ListDocumentedItems, json!({"me_id": "me"}));
    let items = all["additions"]["documented_items"].as_array().unwrap();
    assert_eq!(items.len(), 2);
    assert_eq!(items[0]["owner_type"], "SPLIT"); // newest first
    assert_eq!(items[0]["counterparty_name"], "Rahul");
    assert_eq!(items[0]["attachment_count"], 1);
    assert_eq!(items[1]["attachment_count"], 2);
    let warranties = call(Action::ListDocumentedItems, json!({"doc_type": "WARRANTY", "me_id": "me"}));
    assert_eq!(warranties["additions"]["documented_items"].as_array().unwrap().len(), 1);
    let unclassified = call(Action::ListDocumentedItems, json!({"doc_type": "UNCLASSIFIED"}));
    assert_eq!(unclassified["additions"]["documented_items"].as_array().unwrap().len(), 1);

    let updated = call(
        Action::UpdateAttachmentType,
        json!({"attachment_id": "a22", "doc_type": "INVOICE", "source": "USER"}),
    );
    assert_eq!(updated["updates"]["attachments"][0]["doc_type"], "INVOICE");
    let bad = JsHandler::get_js_handler().execute_action(
        Action::UpdateAttachmentType,
        Some(json!({"attachment_id": "a22", "doc_type": "NOPE"})),
    );
    assert_eq!(bad["status"], "error");

    call(Action::DeleteAttachments, json!({"attachment_ids": ["a22"]}));
    let count = |sql: &str| -> i64 {
        DB.get_connection().unwrap().query_row(sql, [], |r| r.get(0)).unwrap()
    };
    assert_eq!(count("SELECT COUNT(*) FROM attachment_blob WHERE attachment_id='a22'"), 0);

    // Deleting the owners cascades.
    crate::services::transaction::dbUtils::delete_transaction_from_database(txn_id as u32).unwrap();
    assert_eq!(count("SELECT COUNT(*) FROM attachment WHERE owner_type='TRANSACTION'"), 0);
    crate::services::split::service::delete_split("split-1").unwrap();
    assert_eq!(count("SELECT COUNT(*) FROM attachment"), 0);
    assert_eq!(count("SELECT COUNT(*) FROM attachment_blob"), 0);

    // Backups travel as base64 and still round-trip, attachments included.
    call(
        Action::AddAttachments,
        json!({"owner_type": "SPLIT", "owner_id": "split-1",
               "attachments": [meta("c4444", Some("RECEIPT"), None)]}),
    );
    let export = call(Action::ExportData, json!({}));
    let archive = export["file"].as_str().expect("export should be a base64 string");
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD.decode(archive).unwrap();
    assert_eq!(&bytes[..2], b"PK");
    DB.get_connection().unwrap().execute_batch("DELETE FROM attachment_blob; DELETE FROM attachment;").unwrap();
    call(Action::ImportData, json!({"file": archive}));
    let restored = call(Action::GetAttachmentData, json!({"attachment_id": "c4444"}));
    assert_eq!(restored["data"], "DATA-c4444");

    // AI classification must not override a user's choice, but may fill an empty one.
    call(Action::UpdateAttachmentType, json!({"attachment_id": "c4444", "doc_type": "WARRANTY", "source": "USER"}));
    let r = call(Action::UpdateAttachmentType, json!({"attachment_id": "c4444", "doc_type": "BILL", "source": "AI"}));
    assert_eq!(r["updates"]["attachments"][0]["doc_type"], "WARRANTY");
    call(Action::UpdateAttachmentType, json!({"attachment_id": "c4444", "doc_type": null, "source": null}));
    let r = call(Action::UpdateAttachmentType, json!({"attachment_id": "c4444", "doc_type": "BILL", "source": "AI"}));
    assert_eq!(r["updates"]["attachments"][0]["doc_type"], "BILL");
    assert_eq!(r["updates"]["attachments"][0]["doc_type_source"], "AI");
}

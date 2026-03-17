use std::error::Error;

use crate::api::response::{Entity, Response};


pub fn handle_entity_fetch<T, F>(fetch_fn: F, entity_constructor: fn(T) -> Entity, response: &mut Response, error_message: &str)
where
    F: FnOnce() -> Result<Vec<T>, Box<dyn Error>>,
{
    match fetch_fn() {
        Ok(entities) => {
            for entity in entities {
                response.push_addition(entity_constructor(entity));
            }
        }
        Err(err) => {
            response.set_message(&format!("{}, {}", error_message, err.to_string()));
        }
    }
}


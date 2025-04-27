use super::{
    db_utils::{
        add_category_to_database, delete_category_from_database, get_all_categories_from_database,
        update_category_in_database,
    },
    model::Category,
};
use std::error::Error;

pub fn add_category(category: Category) -> Result<Category, Box<dyn Error>> {
    let category = add_category_to_database(category)?;
    Ok(category)
}

pub fn get_all_categories() -> Result<Vec<Category>, Box<dyn Error>> {
    let categories = get_all_categories_from_database()?;
    return Ok(categories);
}

pub fn update_category(category: Category) -> Result<Category, Box<dyn Error>> {
    let category = update_category_in_database(category)?;
    Ok(category)
}

pub fn delete_category(category: Category) -> Result<(), Box<dyn Error>> {
    if let Some(id) = category.id {
        let result = delete_category_from_database(id)?;
        return Ok(result);
    }
    Err("The category doesn't contain an id".into())
}

use super::{db_utils::{add_category_to_database, get_all_categories_from_database}, model::Category};
use std::error::Error;

pub fn add_category(category: Category) -> Result<Category, Box<dyn Error>> {
    let category = add_category_to_database(category)?;
    Ok(category)
}

pub fn get_all_categories()->Result<Vec<Category>, Box<dyn Error>>{
    let categories = get_all_categories_from_database()?;
    return Ok(categories);
}

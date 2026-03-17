use rusqlite::{params, Result};

use crate::services::database::DB;

use super::model::Category;

pub fn add_category_to_database(category: Category) -> Result<Category> {
    let conn = DB.get_connection()?;
    conn.execute(
        "INSERT INTO categories (name, icon_name, icon_type, is_subcategory, parent_category, is_deleted) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6);",
        params![
            category.name,
            category.icon_name,
            category.icon_type,
            category.is_subcategory,
            category.parent_category,
            category.is_deleted
        ],
    )?;
    let last_id = conn.last_insert_rowid() as u32;
    Ok(Category {
        id: Some(last_id),
        ..category
    })
}

pub fn get_category_from_database(id: u32) -> Result<Category> {
    let conn = DB.get_connection()?;
    let mut stmt = conn.prepare(
        "SELECT id, name, icon_name, icon_type, is_subcategory, parent_category, is_deleted 
         FROM categories 
         WHERE id = ?1",
    )?;
    let mut rows = stmt.query(params![id])?;
    if let Some(row) = rows.next()? {
        Ok(Category {
            id: Some(row.get(0)?),
            name: row.get(1)?,
            icon_name: row.get(2)?,
            icon_type: row.get(3)?,
            is_subcategory: row.get(4)?,
            parent_category: row.get(5)?,
            is_deleted: row.get(6)?,
        })
    } else {
        Err(rusqlite::Error::QueryReturnedNoRows)
    }
}

pub fn update_category_in_database(category: Category) -> Result<Category> {
    let conn = DB.get_connection()?;
    conn.execute(
        "UPDATE categories 
         SET name = ?1, icon_name = ?2, icon_type = ?3, is_subcategory = ?4, 
             parent_category = ?5, is_deleted = ?6 
         WHERE id = ?7",
        params![
            category.name,
            category.icon_name,
            category.icon_type,
            category.is_subcategory,
            category.parent_category,
            category.is_deleted,
            category.id
        ],
    )?;
    Ok(category)
}

pub fn delete_category_from_database(id: u32) -> Result<()> {
    let conn = DB.get_connection()?;
    conn.execute(
        "UPDATE categories SET is_deleted = 1 WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

pub fn get_all_categories_from_database() -> Result<Vec<Category>> {
    let conn = DB.get_connection()?;
    let mut stmt = conn.prepare(
        "SELECT id, name, icon_name, icon_type, is_subcategory, parent_category, is_deleted 
         FROM categories",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Category {
            id: Some(row.get(0)?),
            name: row.get(1)?,
            icon_name: row.get(2)?,
            icon_type: row.get(3)?,
            is_subcategory: row.get(4)?,
            parent_category: row.get(5)?,
            is_deleted: row.get(6)?,
        })
    })?;

    let mut categories = Vec::new();
    for category in rows {
        categories.push(category?);
    }
    Ok(categories)
}

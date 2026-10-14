use rusqlite::{params, Result};

use crate::services::database::DB;

use super::model::CategoryBudget;

pub fn upsert_category_budget_in_database(budget: CategoryBudget) -> Result<CategoryBudget> {
    let conn = DB.get_connection()?;
    conn.execute(
        "INSERT INTO category_budgets (category_id, amount) VALUES (?1, ?2)
         ON CONFLICT(category_id) DO UPDATE SET amount = excluded.amount;",
        params![budget.category_id, budget.amount],
    )?;

    // Fetch the row back to get the id
    let mut stmt = conn.prepare(
        "SELECT id, category_id, amount FROM category_budgets WHERE category_id = ?1",
    )?;
    let row = stmt.query_row(params![budget.category_id], |row| {
        Ok(CategoryBudget {
            id: Some(row.get(0)?),
            category_id: row.get(1)?,
            amount: row.get(2)?,
        })
    })?;
    Ok(row)
}

pub fn delete_category_budget_from_database(category_id: u32) -> Result<()> {
    let conn = DB.get_connection()?;
    conn.execute(
        "DELETE FROM category_budgets WHERE category_id = ?1",
        params![category_id],
    )?;
    Ok(())
}

pub fn get_all_category_budgets_from_database() -> Result<Vec<CategoryBudget>> {
    let conn = DB.get_connection()?;
    let mut stmt = conn.prepare(
        "SELECT id, category_id, amount FROM category_budgets",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(CategoryBudget {
            id: Some(row.get(0)?),
            category_id: row.get(1)?,
            amount: row.get(2)?,
        })
    })?;

    let mut budgets = Vec::new();
    for budget in rows {
        budgets.push(budget?);
    }
    Ok(budgets)
}

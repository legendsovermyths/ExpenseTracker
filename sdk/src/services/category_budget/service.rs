use super::{
    db_utils::{
        delete_category_budget_from_database, get_all_category_budgets_from_database,
        upsert_category_budget_in_database,
    },
    model::CategoryBudget,
};
use std::error::Error;

pub fn upsert_category_budget(budget: CategoryBudget) -> Result<CategoryBudget, Box<dyn Error>> {
    let budget = upsert_category_budget_in_database(budget)?;
    Ok(budget)
}

pub fn delete_category_budget(category_id: u32) -> Result<(), Box<dyn Error>> {
    delete_category_budget_from_database(category_id)?;
    Ok(())
}

pub fn get_all_category_budgets() -> Result<Vec<CategoryBudget>, Box<dyn Error>> {
    let budgets = get_all_category_budgets_from_database()?;
    Ok(budgets)
}

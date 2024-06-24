import * as SQLite from "expo-sqlite";
import { subscription } from "../constants/icons";
import { endAsyncEvent } from "react-native/Libraries/Performance/Systrace";

const db = SQLite.openDatabaseSync("mydb.db");
const addAccountToDatabase = async (bank) => {
  try {
    let bankId = null;
    const result = await db.runAsync(
      "INSERT INTO banks (name, amount) VALUES (?, ?)",
      [bank.name, bank.amount]
    );
    bankId = result.lastInsertRowId;
    console.log("Bank added successfully with ID:", bankId);
    return bankId;
  } catch (error) {
    console.error("Error adding bank:", error);
    return null;
  }
};

const deleteAccountFromDatabase = async (id) => {
  try {
    await db.runAsync("DELETE FROM banks WHERE id = ?", [id]);
    console.log("Bank deleted successfully");
  } catch (error) {
    console.error("Error deleting bank:", error);
  }
};

const deleteTransactionFromDatabase = async (id) => {
  try {
    await db.runAsync("DELETE FROM transactions WHERE id = ?", [id]);
    console.log("Transaction deleted successfully");
  } catch (error) {
    console.error("Error deleting transaction:", error);
  }
};

const clearAccountsTable = async () => {
  try {
    await new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          "DELETE FROM banks",
          [],
          () => {
            resolve();
          },
          (_, error) => {
            reject(error);
          }
        );
      });
    });
    console.log("Banks table cleared successfully");
  } catch (error) {
    console.error("Error clearing banks table:", error);
  }
};

const updateBankInDatabase = async (updatedBank) => {
  try {
    await db.runAsync("UPDATE banks SET amount = ? WHERE name = ?", [
      updatedBank.amount,
      updatedBank.name,
    ]);
    console.log("Bank updated successfully");
  } catch (error) {
    console.error("Error updating banks table:", error);
  }
};

const addTransactionToDatabase = async (transaction) => {
  try {
    const result = await db.runAsync(
      "INSERT INTO transactions (title, amount, date, bank_name, category, on_record ) VALUES (?, ?, ?, ?, ?, ?)",
      [
        transaction.title,
        transaction.amount,
        transaction.date_with_time,
        transaction.bank_name,
        transaction.category_id,
        transaction.on_record,
      ]
    );
    const transactionId = result.lastInsertRowId;
    console.log("Transaction added successfully with ID:", transactionId);
    return transactionId;
  } catch (error) {
    console.error("Error adding transaction:", error);
    return null;
  }
};
const clearTransactionsTable = async () => {
  try {
    await db.runAsync("DELETE FROM transactions");
    console.log("Transaction table cleared successfully");
  } catch (error) {
    console.error("Error clearing banks table:", error);
  }
};
const updateBalanceInDatabase = async (newValue) => {
  try {
    await db.runAsync("UPDATE constants SET value = ? WHERE name = ?", [
      newValue,
      "balance",
    ]);
    console.log("Balance updated successfully");
  } catch (error) {
    console.error("Error updating balance:", error);
  }
};

const clearConstantsTable = async () => {
  try {
    await new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          "DELETE FROM constants",
          [],
          () => {
            resolve();
          },
          (_, error) => {
            reject(error);
          }
        );
      });
    });
    console.log("constants table cleared successfully");
  } catch (error) {
    console.error("Error clearing constants table:", error);
  }
};
const addSubscriptionToDatabase = async (subscription) => {
  try {
    let subscriptionId = null;
    const result = await db.runAsync(
      `INSERT INTO subscriptions (amount, bank_name, category, frequency, last_date, next_date, on_record, title) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        subscription.amount,
        subscription.bank_name,
        subscription.category_id,
        subscription.frequency,
        subscription.last_date,
        subscription.next_date,
        subscription.on_record,
        subscription.title,
      ]
    );
    subscriptionId = result.lastInsertRowId;
    console.log("subscription added successfully with ID:", subscriptionId);
    return subscriptionId;
  } catch (error) {
    console.error("Error adding subscription", error);
    return null;
  }
};
const updateSubscriptionInDatabase = async (subscription) => {
  try {
    await db.runAsync(
      "UPDATE subscriptions SET last_date = ?, next_date=? WHERE id = ?",
      [subscription.last_date, subscription.next_date, subscription.id]
    );
    console.log("Subscription updated successfully");
  } catch (error) {
    console.error("Error updating subscription:", error);
  }
};

const deleteSubscriptionFromDatabase = async (id) => {
  try {
    await db.runAsync("DELETE FROM subscriptions WHERE id = ?", [id]);
    console.log("Subscription deleted successfully");
  } catch (error) {
    console.error("Error deleting subscription:", error);
  }
};
const addCategoryToDatabase = async (category) => {
  try {
    let categoryId = null;
    const result = await db.runAsync(
      `INSERT INTO categories (name, icon_name, icon_type, is_subcategory, parent_category) 
      VALUES (?, ?, ?, ?, ?)`,
      [
        category.name,
        category.icon_name,
        category.icon_type,
        category.is_subcategory,
        category.parent_category,
      ]
    );
    categoryId = result.lastInsertRowId;
    console.log("Category added successfully with ID:", categoryId);
    return categoryId;
  } catch (error) {
    console.error("Error adding category", error);
    return null;
  }
};
const deleteCategoryFromDatabase = async (id) => {
  try {
    await db.runAsync("UPDATE categories SET deleted = 1 WHERE id = ?", [id]);
    console.log("Category marked as deleted successfully");
  } catch (error) {
    console.error("Error updating category:", error);
  }
};

const editCategoryInDatabase = async (updatedCategory) =>{
  const { id, name, icon_name, icon_type, is_subcategory, parent_category} = updatedCategory;
  try {
    await db.runAsync(
      `UPDATE categories SET 
        name = ?, 
        icon_name = ?, 
        icon_type = ?, 
        is_subcategory = ?, 
        parent_category = ?
      WHERE id = ?`, 
      [name, icon_name, icon_type, is_subcategory, parent_category, id]
    );

    console.log('Category updated successfully');
  }
    catch (error) {
      console.error('Error updating category:', error);
    }
}
export {
  addAccountToDatabase,
  deleteAccountFromDatabase,
  deleteTransactionFromDatabase,
  addTransactionToDatabase,
  updateBankInDatabase,
  updateBalanceInDatabase,
  addSubscriptionToDatabase,
  updateSubscriptionInDatabase,
  deleteSubscriptionFromDatabase,
  addCategoryToDatabase,
  deleteCategoryFromDatabase,
  editCategoryInDatabase
};

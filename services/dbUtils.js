import * as SQLite from "expo-sqlite";
import { subscription } from "../constants/icons";
import { endAsyncEvent } from "react-native/Libraries/Performance/Systrace";

const db = SQLite.openDatabase("mydb.db");
const addAccountToDatabase = async (bank) => {
  try {
    let bankId = null;
    await new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          "INSERT INTO banks (name, amount) VALUES (?, ?)",
          [bank.name, bank.amount],
          (_, result) => {
            bankId = result.insertId;
            resolve();
          },
          (_, error) => {
            reject(error);
          }
        );
      });
    });
    console.log("Bank added successfully with ID:", bankId);
    return bankId;
  } catch (error) {
    console.error("Error adding bank:", error);
    return null;
  }
};

const deleteAccountFromDatabase = async (id) => {
  try {
    await new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          "DELETE FROM banks WHERE id = ?",
          [id],
          () => {
            resolve();
          },
          (_, error) => {
            reject(error);
          }
        );
      });
    });
    console.log("Bank deleted successfully");
  } catch (error) {
    console.error("Error deleting bank:", error);
  }
};
const deleteTransactionFromDatabase = async (id) => {
  try {
    await new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          "DELETE FROM transactions WHERE id = ?",
          [id],
          () => {
            resolve();
          },
          (_, error) => {
            reject(error);
          }
        );
      });
    });
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
    await new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          "UPDATE banks SET amount = ? WHERE name = ?",
          [updatedBank.amount, updatedBank.name],
          () => {
            resolve();
          },
          (_, error) => {
            reject(error);
          }
        );
      });
    });
    console.log("Bank updated successfully");
  } catch (error) {
    console.error("Error updating banks table:", error);
  }
};
const addTransactionToDatabase = async (transaction) => {
  try {
    let transactionId = null;
    await new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          "INSERT INTO transactions (title, amount, date, bank_name, category, on_record ) VALUES (?, ?, ?, ?, ?, ?)",
          [
            transaction.title,
            transaction.amount,
            transaction.date,
            transaction.bank_name,
            transaction.category,
            transaction.on_record,
          ],
          (_, result) => {
            transactionId = result.insertId;
            resolve();
          },
          (_, error) => {
            reject(error);
          }
        );
      });
    });
    console.log("transaction added successfully with ID:", transactionId);
    return transactionId;
  } catch (error) {
    console.error("Error adding bank:", error);
    return null;
  }
};
const clearTransactionsTable = async () => {
  try {
    await new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          "DELETE FROM transactions",
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
    console.log("Transaction table cleared successfully");
  } catch (error) {
    console.error("Error clearing banks table:", error);
  }
};
const updateBalanceInDatabase = async (newValue) => {
  try {
    await new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          "UPDATE constants SET value = ? WHERE name = ?",
          [newValue, "balance"],
          () => {
            resolve();
          },
          (_, error) => {
            reject(error);
          }
        );
      });
    });
    console.log("Balance updated successfully");
  } catch (error) {
    console.error("Error updating banks table:", error);
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
    await new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          `INSERT INTO subscriptions (amount, bank_name, category, frequency, last_date, next_date, on_record, title) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            subscription.amount,
            subscription.bank_name,
            subscription.category,
            subscription.frequency,
            subscription.last_date,
            subscription.next_date,
            subscription.on_record,
            subscription.title,
          ],
          (_, result) => {
            subscriptionId = result.insertId;
            resolve();
          },
          (_, error) => {
            reject(error);
          }
        );
      });
    });
    console.log("subscription added successfully with ID:", subscriptionId);
    return subscriptionId;
  } catch (error) {
    console.error("Error adding subscription", error);
    return null;
  }
};
const updateSubscriptionInDatabase = async (subscription) => {
  try {
    await new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          "UPDATE subscriptions SET last_date = ?, next_date=? WHERE id = ?",
          [subscription.last_date, subscription.next_date, subscription.id],
          () => {
            resolve();
          },
          (_, error) => {
            reject(error);
          }
        );
      });
    });
    console.log("subscription updated successfully");
  } catch (error) {
    console.error("Error updating subscription table:", error);
  }
};

export {
  addAccountToDatabase,
  deleteAccountFromDatabase,
  deleteTransactionFromDatabase,
  addTransactionToDatabase,
  updateBankInDatabase,
  updateBalanceInDatabase,
  addSubscriptionToDatabase,
  updateSubscriptionInDatabase,
};

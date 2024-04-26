import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabase('mydb.db');
const addAccountToDatabase = async (bank) => {
  try {
    let bankId = null;
    await new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'INSERT INTO banks (name, amount) VALUES (?, ?)',
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
    console.log('Bank added successfully with ID:', bankId);
    return bankId;
  } catch (error) {
    console.error('Error adding bank:', error);
    return null;
  }
};

const deleteAccountFromDatabase = async (id) => {
  try {
    await new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'DELETE FROM banks WHERE id = ?',
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
    console.log('Bank deleted successfully');
  } catch (error) {
    console.error('Error deleting bank:', error);
  }
};
const deleteTransactionFromDatabase = async (id) => {
  try {
    await new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'DELETE FROM transactions WHERE id = ?',
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
    console.log('Transaction deleted successfully');
  } catch (error) {
    console.error('Error deleting transaction:', error);
  }
};
const clearAccountsTable = async () => {
  try {
    await new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'DELETE FROM banks',
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
    console.log('Banks table cleared successfully');
  } catch (error) {
    console.error('Error clearing banks table:', error);
  }
};


export {addAccountToDatabase,deleteAccountFromDatabase,deleteTransactionFromDatabase}

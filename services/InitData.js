import React, { useEffect } from 'react';
import * as FileSystem from 'expo-file-system';
import * as SQLite from 'expo-sqlite';


const db = SQLite.openDatabase('mydb.db');
const initData = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(
      FileSystem.documentDirectory + 'SQLite/'
    );
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(
        FileSystem.documentDirectory + 'SQLite/',
        { intermediates: true }
      );
    }
    await new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'CREATE TABLE IF NOT EXISTS banks (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, name TEXT UNIQUE, amount INTEGER)',
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
    // const banksData = [
    //   { name: 'HDFC', amount: 25000 },
    //   { name: 'ICICI', amount: 30000 },
    //   { name: 'KOTAK', amount: 300 }
    // ];
    // await Promise.all(banksData.map(async bank => {
    //   const { name, amount } = bank;
    //   await new Promise((resolve, reject) => {
    //     db.transaction(tx => {
    //       tx.executeSql(
    //         'INSERT OR IGNORE INTO banks (name, amount) VALUES (?, ?)',
    //         [name, amount],
    //         () => {
    //           resolve();
    //         },
    //         (_, error) => {
    //           reject(error);
    //         }
    //       );
    //     });
    //   });
    // }));
    await new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, title TEXT, amount INTEGER, date TEXT, bank_name TEXT, category TEXT, on_record INTEGER, FOREIGN KEY(bank_name) REFERENCES banks(name))',
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

    // const transactionsData = [
    //   { title: 'Food with Friends', amount: -600, date: '2024-04-13', bankName: 'HDFC', category: 'Food', on_record: 1 },
    //   { title: 'Grocery Shopping', amount: -200, date: '2024-04-12', bankName: 'HDFC', category: 'Food', on_record: 1 }
    // ];
    // await Promise.all(transactionsData.map(async transaction => {
    //   const { title, amount, date, bankName, category, on_record } = transaction;
    //   await new Promise((resolve, reject) => {
    //     db.transaction(tx => {
    //       tx.executeSql(
    //         'INSERT INTO transactions (title, amount, date, bank_name, category, on_record) VALUES (?, ?, ?, ?, ?, ?)',
    //         [title, amount, date, bankName, category, on_record],
    //         () => {
    //           resolve();
    //         },
    //         (_, error) => {
    //           reject(error);
    //         }
    //       );
    //     });
    //   });
    // }));

  } catch (error) {
    console.error('Error initializing data:', error);
  }
};


const InitDataComponent = ({ onInit }) => {

  useEffect(() => {
    const initializeData = async () => {
      await initData();
    };
    initializeData();
    onInit()
  }, []);

  return null;
};

export default InitDataComponent;

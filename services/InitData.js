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
    await new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(`
        CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            amount REAL,
            bank_name TEXT,
            category TEXT,
            frequency TEXT,
            icon INTEGER,
            last_date DATE,
            next_date DATE,
            on_record INTEGER,
            title TEXT,
            FOREIGN KEY (bank_name) REFERENCES banks (name)
        );`,
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
    await new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'CREATE TABLE IF NOT EXISTS constants (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, name TEXT UNIQUE, value INTEGER)',
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
    const constantsData = [
      { name: 'balance', value: 10000 },
    ];
    await Promise.all(constantsData.map(async constant => {
      const { name, value } = constant;
      await new Promise((resolve, reject) => {
        db.transaction(tx => {
          tx.executeSql(
            'INSERT OR IGNORE INTO constants (name, value) VALUES (?, ?)',
            [name, value],
            () => {
              resolve();
            },
            (_, error) => {
              reject(error);
            }
          );
        });
      });
    }));
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

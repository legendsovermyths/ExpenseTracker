import React, { useEffect } from "react";
import * as FileSystem from "expo-file-system";
import * as SQLite from "expo-sqlite";

const db = SQLite.openDatabaseSync("mydb.db");
const initData = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(
      FileSystem.documentDirectory + "SQLite/"
    );
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(
        FileSystem.documentDirectory + "SQLite/",
        { intermediates: true }
      );
    }

    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS banks (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        name TEXT UNIQUE,
        amount INTEGER
      )
    `);
    await db.runAsync(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    name TEXT,
    icon_name TEXT,
    icon_type TEXT,
    is_subcategory INTEGER,
    parent_category TEXT REFERENCES categories(name)
  )
`);

    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL,
        bank_name TEXT,
        category INTEGER,
        frequency TEXT,
        icon INTEGER,
        last_date DATE,
        next_date DATE,
        on_record INTEGER,
        title TEXT,
        FOREIGN KEY (bank_name) REFERENCES banks (name),
        FOREIGN KEY(category) REFERENCES categories(id)
      )
    `);

    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS constants (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        name TEXT UNIQUE,
        value INTEGER
      )
    `);

    const constantsData = [{ name: "balance", value: 10000 }];

    await Promise.all(
      constantsData.map(async (constant) => {
        const { name, value } = constant;
        await db.runAsync(
          "INSERT OR IGNORE INTO constants (name, value) VALUES (?, ?)",
          [name, value]
        );
      })
    );
    await db.runAsync(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      title TEXT,
      amount INTEGER,
      date TEXT,
      bank_name TEXT,
      category INTEGER,
      on_record INTEGER,
      FOREIGN KEY(bank_name) REFERENCES banks(name),
      FOREIGN KEY(category) REFERENCES categories(id)
    )
  `);
  } catch (error) {
    console.error("Error initializing data:", error);
  }
};

const InitDataComponent = ({ onInit }) => {
  useEffect(() => {
    const initializeData = async () => {
      await initData();
    };
    initializeData();
    onInit();
  }, []);

  return null;
};

export default InitDataComponent;

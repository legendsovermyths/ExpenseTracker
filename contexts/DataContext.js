import React, { createContext, useState, useEffect } from "react";
import { Text } from "react-native";
import IconCategoryMapping from "../services/IconCategoryMapping";
import {
  addSubscriptionsToTransactions,
} from "../services/SubscriptionService";
import * as SQLite from "expo-sqlite";

const db = SQLite.openDatabaseSync("mydb.db");

const DataContext = createContext();

const DataContextProvider = ({ children }) => {
  const [transactions, setTransactions] = useState([]);
  const [constants, setConstants] = useState([]);
  const [banks, setBanks] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mainCategories,setMainCategories] = useState([])
  useEffect(() => {
    const loadDataFromDatabase = async () => {
      try {
        const transactionsQuery = "SELECT * FROM transactions";
        const banksQuery = "SELECT * FROM banks";
        const subscriptionsQuery = "SELECT * FROM subscriptions";
        const constantsQuery = "SELECT * FROM constants";
        const categoriesQuery = "SELECT * from categories";
        let transactions = [],
          banks = [],
          subscriptions = [],
          categories = [];
        transactions = await db.getAllAsync(transactionsQuery);
        banks = await db.getAllAsync(banksQuery);
        subscriptions = await db.getAllAsync(subscriptionsQuery);
        categories = await db.getAllAsync(categoriesQuery);
        const mainCategories = categories.filter(category => category.is_subcategory === 0);
        const categoryMap = categories.reduce((acc, category) => {
          acc[category.name] = { icon_name: category.icon_name, icon_type: category.icon_type, is_subcategory:category.is_subcategory, parent_category:category.parent_category };
          return acc;
        }, {});
        const { updatedTransactions, updatedBanks, updatedSubscriptions } =
          await addSubscriptionsToTransactions(
            subscriptions,
            transactions,
            banks,
            categoryMap
          );
        updatedTransactions.map(
          (transaction) => {console.log(transaction.category);})
        const updatedTransactionsWithIcons = updatedTransactions.map(
          (transaction) => ({
            ...transaction,
            icon_name: categoryMap[transaction.category].icon_name,
            icon_type: categoryMap[transaction.category].icon_type,
            parent_category:categoryMap[transaction.category].parent_category
          })
        );
        setMainCategories(mainCategories)
        setCategories(categoryMap);
        setBanks(updatedBanks);
        setTransactions(updatedTransactionsWithIcons);
        setSubscriptions(updatedSubscriptions);
        const constants = await db.getAllAsync(constantsQuery);
        setConstants(constants);
        setIsLoading(false);
      } catch (error) {
        console.error("Error loading data:", error);
        setIsLoading(false);
      }
    };

    loadDataFromDatabase();
  }, []);
  const updateTransactions = (updatedTransactions) => {
    setTransactions(updatedTransactions);
  };
  const updateCategories = (updatedCategories) => {
    setCategories(updatedCategories);
  }
  const updateBanks = (updatedBanks) => {
    setBanks(updatedBanks);
  };
  const updateSubscriptions = (updatedSubscriptions) => {
    setSubscriptions(updatedSubscriptions);
  };
  const updateConstants = (updatedConstants) => {
    setConstants(updatedConstants);
  };
  const updateMainCategories = (updateMainCategories) =>{
    setMainCategories(updateMainCategories);
  }

  if (isLoading) {
    return <Text>Loading...</Text>;
  }

  return (
    <DataContext.Provider
      value={{
        transactions,
        banks,
        subscriptions,
        constants,
        categories,
        mainCategories,
        updateTransactions,
        updateBanks,
        updateSubscriptions,
        updateConstants,
        updateCategories,
        updateMainCategories
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export { DataContextProvider, DataContext };

import React, { createContext, useState, useEffect } from 'react';
import IconCategoryMapping from "../services/IconCategoryMapping"
import * as SQLite from 'expo-sqlite';
import { icons } from '../constants';

const db = SQLite.openDatabase('mydb.db');

const DataContext = createContext();

const DataContextProvider = ({ children }) => {
  const [transactions, setTransactions] = useState([]);
  const [constants, setConstants]=useState([])
  const [banks, setBanks] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadDataFromDatabase = async () => {
      try {
        const transactionsQuery = 'SELECT * FROM transactions';
        const banksQuery = 'SELECT * FROM banks';
        const subscriptionsQuery = 'SELECT * FROM transactions';
        const constantsQuery ='SELECT * FROM constants'
        await new Promise((resolve, reject) => {
          db.transaction(tx => {
            tx.executeSql(
              transactionsQuery,
              [],
              (_, result) => {
                const transactions = result.rows._array
                const updatedTransactions = transactions.map(transaction => ({
                  ...transaction,
                  icon:IconCategoryMapping[transaction.category]
                }));
                setTransactions(updatedTransactions);
              },
              (_, error) => {
                reject(error);
              }
            );
            tx.executeSql(
              banksQuery,
              [],
              (_, result) => {
                const banks = result.rows._array;
                setBanks(banks);
              },
              (_, error) => {
                reject(error);
              }
            );
            tx.executeSql(
              subscriptionsQuery,
              [],
              (_, result) => {
                const subscriptions = result.rows._array;
                setSubscriptions(subscriptions);
                resolve();
              },
              (_, error) => {
                reject(error);
              }
            );
            tx.executeSql(
              constantsQuery,
              [],
              (_, result) => {
                const constants = result.rows._array;
                setConstants(constants);
              },
              (_, error) => {
                reject(error);
              }
            );
          });
        });
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setIsLoading(false);
      }
    };

    loadDataFromDatabase();
  }, []);
  const updateTransactions = (updatedTransactions) => {
    setTransactions(updatedTransactions);
  };
  const updateBanks = (updatedBanks) => {
    setBanks(updatedBanks);
  };
  const updateSubscriptions = (updatedSubscriptions) => {
    setSubscriptions(updatedSubscriptions);
  };
  const updateConstants = (updatedConstants) => {
    setConstants(updatedConstants);
  }

  if (isLoading) {
    return <Text>Loading...</Text>;
  }

  return (
    <DataContext.Provider
      value={{ transactions, banks, subscriptions, constants ,updateTransactions, updateBanks, updateSubscriptions, updateConstants }}
    >
      {children}
    </DataContext.Provider>
  );
};

export { DataContextProvider, DataContext };

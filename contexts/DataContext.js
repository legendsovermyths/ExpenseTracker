import React, { createContext, useState, useEffect } from 'react';
import Papa from 'papaparse';
import IconCategoryMapping from '../services/IconCategoryMapping';
import { View, Text } from 'react-native';
import * as FileSystem from 'expo-file-system'

const DataContext = createContext();

const DataContextProvider = ({ children }) => {
  const [transactions, setTransactions] = useState([]);
  const [banks, setBanks] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {  
    const loadCsvData = async () => {
      try {
        const transactionsFilePath = `${FileSystem.documentDirectory}/data/transactions.csv`;
        const banksFilePath = `${FileSystem.documentDirectory}/data/accounts.csv`;
        const subscriptionsFilePath = `${FileSystem.documentDirectory}/data/subscriptions.csv`;

        const [transactionsCsvData, banksCsvData, subscriptionsCsvData] =
          await Promise.all([
            FileSystem.readAsStringAsync(transactionsFilePath),
            FileSystem.readAsStringAsync(banksFilePath),
            FileSystem.readAsStringAsync(subscriptionsFilePath),
          ]);

        const [parsedTransactions, parsedBanks, parsedSubscriptions] =
          await Promise.all([
            parseCsvData(transactionsCsvData),
            parseCsvData(banksCsvData),
            parseCsvData(subscriptionsCsvData),
          ]);

        setTransactions(parsedTransactions);
        setBanks(parsedBanks);
        setSubscriptions(parsedSubscriptions);
        setIsLoading(false);
      } catch (error) {
        console.error("Error loading data:", error);
        setIsLoading(false);
      }
    };

    loadCsvData();
  }, []);

  const parseCsvData = (csvData) => {
  return new Promise((resolve, reject) => {
      Papa.parse(csvData, {
        header: true,
        complete: (result) => {
          resolve(result.data.map((item) => ({
            ...item,
            icon: IconCategoryMapping[item.category],
          })));
        },
      });
    });
  };

  const updateTransactions = (updatedTransactions) => {
    setTransactions(updatedTransactions);
  };
  const updateBanks = (updatedBanks) => {
    setBanks(updatedBanks);
  };
  const updateSubscriptions = (updatedSubscriptions) => {
    setSubscriptions(updatedSubscriptions);
  };

  if (isLoading) {
    return <Text>Loading...</Text>; // or a loading spinner or message
  }

  return (
    <DataContext.Provider
      value={{ transactions, banks, subscriptions, updateTransactions, updateBanks, updateSubscriptions }}
    >
      {children}
    </DataContext.Provider>
  );
};

export { DataContextProvider, DataContext };

import React, { createContext, useState, useEffect } from 'react';
import Papa from 'papaparse';
import IconCategoryMapping from '../services/IconCategoryMapping';
import { View, Text } from 'react-native';

const DataContext = createContext();

const DataContextProvider = ({ children }) => {
  const [transactions, setTransactions] = useState([]);
  const [banks, setBanks] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const promises = [
      fetch('../data/transactions.csv')
        .then((response) => response.text())
        .then((csvData) => {
          return new Promise((resolve, reject) => {
            Papa.parse(csvData, {
              header: true,
              complete: (result) => {
                const parsedTransactions = result.data.map((transaction) => ({
                  ...transaction,
                  icon: IconCategoryMapping[transaction.category],
                }));
                setTransactions(parsedTransactions);
                resolve();
              },
            });
          });
        }),
      fetch('../data/accounts.csv')
        .then((response) => response.text())
        .then((csvData) => {
          return new Promise((resolve, reject) => {
            Papa.parse(csvData, {
              header: true,
              complete: (result) => {
                setBanks(result.data);
                resolve();
              },
            });
          });
        }),
      fetch('../data/subscriptions.csv')
        .then((response) => response.text())
        .then((csvData) => {
          return new Promise((resolve, reject) => {
            Papa.parse(csvData, {
              header: true,
              complete: (result) => {
                setSubscriptions(result.data);
                resolve();
              },
            });
          });
        }),
    ];

    Promise.all(promises)
      .then(() => setIsLoading(false))
      .catch((error) => {
        console.error('Error loading data:', error);
        setIsLoading(false);
      });
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

  if (isLoading) {
    return <Text>Loading...</Text>;
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

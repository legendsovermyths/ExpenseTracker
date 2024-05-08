import React, { createContext, useState, useEffect } from 'react';
import IconCategoryMapping from "../services/IconCategoryMapping"
import { handleSubscriptionTransaction } from '../services/SubscriptionService';
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
            const subscriptionsQuery = 'SELECT * FROM subscriptions';
            const constantsQuery = 'SELECT * FROM constants';

            let transactions = [], banks = [];
            await new Promise((resolve, reject) => {
                db.transaction(tx => {
                    tx.executeSql(
                        transactionsQuery,
                        [],
                        (_, result) => {
                            transactions = result.rows._array;
                            transactions = transactions.map(transaction => ({
                                ...transaction,
                                icon: IconCategoryMapping[transaction.category]
                            }));
                            const updatedTransactions=transactions;
                            setTransactions(updatedTransactions);
                            console.log(updatedTransactions);
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
                        banksQuery,
                        [],
                        (_, result) => {
                            banks = result.rows._array;
                            setBanks(banks);
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
                        subscriptionsQuery,
                        [],
                        async (_, result) => {
                            const subscriptions = result.rows._array;
                            const updatedSubscriptions = await Promise.all(subscriptions.map(async (subscription) => {
                                const { updatedTransactions, updatedBanks, subscription: updatedSubscription } = await handleSubscriptionTransaction(subscription, transactions, banks);
                                setTransactions(updatedTransactions);
                                setBanks(updatedBanks);
                                return updatedSubscription;
                            }));
                            setSubscriptions(updatedSubscriptions);
                            console.log(updatedSubscriptions);
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
                        constantsQuery,
                        [],
                        (_, result) => {
                            const constants = result.rows._array;
                            setConstants(constants);
                            resolve();
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

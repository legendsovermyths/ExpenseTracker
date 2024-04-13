import React, { createContext, useState, useEffect, useContext } from 'react';
import Papa from 'papaparse';
import IconCategortMapping from '../services/IconCategoryMapping';
const DataContext = createContext();

const DataContextProvider = ({ children }) => {
  const [transactions, setTransactions] = useState([]);
  const [banks, setBanks] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);

  useEffect(() => {
    Papa.parse('../data/transactions.csv', {
        header: true,
        download: true,
        complete: (result) => {
          console.log(result.data);
          const parsedTransactions = result.data.map((transaction) => ({
            ...transaction,
            icon: IconCategortMapping[transaction.category], // Assuming icons is an object mapping category names to icon components
          }));
          setTransactions(parsedTransactions);
        },
      });
    Papa.parse('../data/accounts.csv', {
      header: true,
      download: true,
      complete: (result) => {
        console.log(result)
        setBanks(result.data);
      },
    });

    Papa.parse('../data/subscriptions.csv', {
      header: true,
      download: true,
      complete: (result) => {
        setSubscriptions(result.data);
      },
    });
  }, []);

  const updateTransactions = (updatedTransactions) => {
    setTransactions(updatedTransactions);
  };
  const updateBanks=(updatedBanks)=>{
    setBanks(updatedBanks)
  };
  const updateSubscriptions=(updatedSubscriptions)=>{
    setSubscriptions(updatedSubscriptions)
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

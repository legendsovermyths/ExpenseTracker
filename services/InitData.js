import React, { useEffect } from 'react';
import * as FileSystem from 'expo-file-system';
const initData = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(
      FileSystem.documentDirectory + "data/"
    );
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(
        FileSystem.documentDirectory + "data/",
        { intermediates: true }
      );
    }
    const transactionsCsv = `id,title,amount,date,bank,category
    1,Food with Friends,600,2024-04-13,HDFC,Food
    2,Grocery Shopping,200,2024-04-12,HDFC,Food
    3,Rent Payment,1200,2024-04-01,HDFC,Housing
    4,Electricity Bill,100,2024-04-05,HDFC,Utilities
    5,Doctor's Visit,50,2024-04-07,HDFC,Healthcare
    6,Movie Tickets,20,2024-04-10,HDFC,Entertainment
    7,Clothing Purchase,50,2024-04-08,HDFC,Shopping
    8,Haircut,30,2024-04-11,HDFC,Personal
    9,Transportation,50,2024-04-02,HDFC,Transport
    10,Miscellaneous Expense,70,2024-04-09,HDFC,Others
    11,Weekend Getaway,300,2024-04-14,HDFC,Transport
    12,Internet Bill,50,2024-04-03,HDFC,Utilities
    13,Health Insurance Premium,200,2024-04-15,HDFC,Healthcare
    14,Concert Tickets,100,2024-04-06,HDFC,Entertainment
    15,Home Decor Purchase,80,2024-04-04,HDFC,Shopping
    16,Beauty Products,40,2024-04-08,HDFC,Personal
    17,Public Transport,20,2024-04-01,HDFC,Transport
    18,Book Purchase,25,2024-04-10,HDFC,Entertainment
    19,Mobile Recharge,10,2024-04-12,HDFC,Utilities
    20,Charity Donation,50,2024-04-05,HDFC,Others`;

    await FileSystem.writeAsStringAsync(
      FileSystem.documentDirectory + "data/transactions.csv",
      transactionsCsv
    );

      const accountsCsv=`id,name,amount
      1,HDFC,25000
      2,ICICI,30000
      3,KOTAK,300`;
      await FileSystem.writeAsStringAsync(FileSystem.documentDirectory + 'data/accounts.csv', accountsCsv);

      const subscriptionsData = [
        { id: 1, name: 'Netflix', amount: 10, frequency: 'Monthly' },
        { id: 2, name: 'Spotify', amount: 5, frequency: 'Monthly' }
      ];
      const subscriptionsCsv = subscriptionsData.map(item => Object.values(item).join(',')).join('\n');
      await FileSystem.writeAsStringAsync(FileSystem.documentDirectory + 'data/subscriptions.csv', subscriptionsCsv);
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
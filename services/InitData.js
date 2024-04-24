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
    const transactionsCsv = `id,title,amount,date,bank,category,on_record\n
    1,Food with Friends,-600,2024-04-13,HDFC,Food,1\n
    2,Grocery Shopping,-200,2024-04-12,HDFC,Food,1\n`;

    await FileSystem.writeAsStringAsync(
      FileSystem.documentDirectory + "data/transactions.csv",
      transactionsCsv
    );

      const accountsCsv=`id,name,amount\n
      1,HDFC,25000\n
      2,ICICI,30000\n
      3,KOTAK,300\n`;
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

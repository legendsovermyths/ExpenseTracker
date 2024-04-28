import {
    updateBankInDatabase,
    addTransactionToDatabase,
    deleteTransactionFromDatabase,
  } from "./dbUtils";

const addTransaction=async (transactionWithoutId, transactions, banks)=>{
    const updatedBanks = banks.map((bank) => {
        if (bank.name === transactionWithoutId.bank_name) {
          return {
            ...bank,
            amount: Number(bank.amount) + Number(transactionWithoutId.amount),
          };
        }
        return bank;
      });;
      const updatedBank = updatedBanks.find(
        (bank) => bank.name === transactionWithoutId.bank_name
      );
      const transactionId = await addTransactionToDatabase(transactionWithoutId);
      const newTransactionWithId = { ...transactionWithoutId, id: transactionId };
      const updatedTransactions = [...transactions, newTransactionWithId];
      await updateBankInDatabase(updatedBank);
      return {updatedTransactions, updatedBanks};
}

const deleteTransactionWithId=async (transactionId, transactions, banks)=>{
      await deleteTransactionFromDatabase(transactionId);
      const updatedTransactions = transactions.filter(transaction => transaction.id !== transactionId);

      const deletedTransaction = transactions.find(transaction => transaction.id === transactionId);
      const updatedBanks = banks.map(bank => {
          if (bank.name === deletedTransaction.bank_name) {
              return {
                  ...bank,
                  amount: Number(bank.amount) - Number(deletedTransaction.amount)
              };
          }
          return bank;
      });
      const updatedBank = updatedBanks.find(bank => bank.name === deletedTransaction.bank_name);

      await updateBankInDatabase(updatedBank);
      return {updatedTransactions, updatedBanks};

}

const editExistingTransaction=async (oldTransaction, newTransactionWithoutId,transactions,banks)=>{
    const {updatedTransactions:updatedInterTransactions, updatedBanks:updatedInterBanks} = await deleteTransactionWithId(oldTransaction.id,transactions,banks);
    const {updatedTransactions, updatedBanks} = await addTransaction(newTransactionWithoutId,updatedInterTransactions,updatedInterBanks);
    return {updatedTransactions, updatedBanks}
}
export {addTransaction,deleteTransactionWithId,editExistingTransaction}
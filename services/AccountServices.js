import { addAccountToDatabase, updateBankInDatabase } from "./DbUtils";
import { calculateNextDate, getDateFromDefaultDate } from "./Utils";
const addAccount = async (bankWithoutId, banks) => {
  const id = await addAccountToDatabase(bankWithoutId);
  const newBank = { id: id, ...bankWithoutId };
  const updatedBanks = [...banks, newBank];
  return updatedBanks;
};

const handleAccountDueDate = async (banks, bank) => {
  let updatedBanks = banks;
  const currentDate = new Date(getDateFromDefaultDate(new Date()));
  while (new Date(bank.due_date) < currentDate) {
    bank.due_date = calculateNextDate(bank.due_date, bank.frequency);
  }
  await updateBankInDatabase(bank);
  updatedBanks = banks.map((element) =>
    element.name == bank.name ? bank : element,
  );
  return updatedBanks;
};

const handleAccountsDueDate = async (banks) => {
  let updatedBanks = banks;
  for (let i = 0; i < banks.length; i++) {
    if (banks[i].is_credit === 1) {
      updatedBanks = await handleAccountDueDate(banks, banks[i]);
    }
  }
  return updatedBanks;
};
function analyzeBankTransactions(transactions, bankId) {
  let numTransactions = 0;
  let totalExpenditure = 0;
  let totalIncome = 0;

  transactions.forEach((transaction) => {
    if (transaction.bank_id === bankId) {
      numTransactions++;
      if (transaction.amount < 0) {
        totalExpenditure += transaction.amount;
      } else {
        totalIncome += transaction.amount;
      }
    }
  });

  return {
    numTransactions,
    totalExpenditure,
    totalIncome,
  };
}
export { addAccount, handleAccountsDueDate, analyzeBankTransactions };

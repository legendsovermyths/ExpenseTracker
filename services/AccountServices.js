import { addAccountToDatabase, updateBankInDatabase } from "./DbUtils";
import { calculateNextDate, getDateFromDefaultDate } from "./Utils";

const addAccount = async (bankWithoutId, banks) => {
  const id = await addAccountToDatabase(bankWithoutId);
  const newBank = { id: id, ...bankWithoutId };
  const updatedBanks = [newBank, ...banks];
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

export { addAccount, handleAccountsDueDate };

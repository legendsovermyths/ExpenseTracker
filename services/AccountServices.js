import { addAccountToDatabase } from "./DbUtils"

const addAccount = async (bankWithoutId, banks) => {
  const id = await addAccountToDatabase(bankWithoutId);
  const newBank = { id: id, ...bankWithoutId};
  const updatedBanks = [newBank, ...banks];
  return updatedBanks;
}

export {addAccount}

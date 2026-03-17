import { Account } from "../types/entity/Account";
import { Appconstant } from "../types/entity/Appconstant";
import { Category } from "../types/entity/Category";
import { Transaction } from "../types/entity/Transaction";
import { create } from "zustand";

interface ExpensifyState {
  accounts: Record<number, Account>;
  categories: Record<number, Category>;
  transactions: Record<number, Transaction>;
  appconstants: Record<string, Appconstant>;

  // Setters
  setAccounts: (accounts: Account[]) => void;
  setAppconstants: (appcontants: Appconstant[]) => void;
  setCategories: (categories: Category[]) => void;
  setTransactions: (transactions: Transaction[]) => void;

  // Adders
  addTransaction: (transaction: Transaction) => void;
  addAccount: (account: Account) => void;
  addCategory: (category: Category) => void;

  // Updaters
  updateAccounts: (account: Account) => void;
  updateTransactions: (transaction: Transaction) => void;
  updateCategories: (category: Category) => void;
  updateAppconstant: (appconstant: Appconstant) => void;

  // Deleters
  deleteTransaction: (transactionId: number) => void;
  deleteAccount: (accountId: number) => void;
  deleteCategory: (categoryId: number) => void;

  getAccountById: (id: number) => Account | undefined;
  getCategoryById: (id: number) => Category | undefined;
  getAppconstantByKey: (key: string) => Appconstant | undefined;
  getAllTransactionsArray: () => Transaction[];
  getAllCategoriesArray: () => Category[];
  getAllAccountsArray: () => Account[];
}

export const useExpensifyStore = create<ExpensifyState>((set, get) => ({
  accounts: {},
  categories: {},
  transactions: {},
  appconstants: {},

  // Setters
  setAppconstants: (appconstants) =>
    set((state) => ({
      appconstants: appconstants.reduce(
        (acc, appconstant) => {
          acc[appconstant.key] = appconstant;
          return acc;
        },
        {} as Record<string, Appconstant>,
      ),
    })),
  setAccounts: (accounts) =>
    set((state) => ({
      accounts: accounts.reduce(
        (acc, account) => {
          acc[account.id] = account;
          return acc;
        },
        {} as Record<number, Account>,
      ),
    })),
  setCategories: (categories) =>
    set((state) => ({
      categories: categories.reduce(
        (acc, category) => {
          acc[category.id] = category;
          return acc;
        },
        {} as Record<number, Category>,
      ),
    })),
  setTransactions: (transactions) =>
    set((state) => ({
      transactions: transactions.reduce(
        (acc, transaction) => {
          acc[transaction.id] = transaction;
          return acc;
        },
        {} as Record<number, Transaction>,
      ),
    })),

  // Adders
  addTransaction: (transaction) =>
    set((state) => {
      const account = state.accounts[transaction.account_id];
      if (!account) return {}; // If account does not exist, do nothing.
      // Update account balance
      const newAmount = transaction.is_credit
        ? account.amount + transaction.amount
        : account.amount - transaction.amount;

      return {
        transactions: { ...state.transactions, [transaction.id]: transaction },
        accounts: {
          ...state.accounts,
          [transaction.account_id]: { ...account, amount: newAmount },
        },
      };
    }),

  addAccount: (account) =>
    set((state) => ({
      accounts: { ...state.accounts, [account.id]: account },
    })),

  addCategory: (category) =>
    set((state) => ({
      categories: { ...state.categories, [category.id]: category },
    })),

  // Updaters
  updateAccounts: (account) =>
    set((state) => ({
      accounts: {
        ...state.accounts,
        [account.id]: { ...state.accounts[account.id], ...account },
      },
    })),
  updateAppconstant: (appconstant) =>
    set((state) => ({
      appconstants: {
        ...state.appconstants,
        [appconstant.key]: {
          ...state.appconstants[appconstant.key],
          ...appconstant,
        },
      },
    })),
  updateTransactions: (transaction) =>
    set((state) => {
      const prevTransaction = state.transactions[transaction.id];
      if (!prevTransaction) return {}; // If transaction doesn't exist, do nothing.

      const account = state.accounts[prevTransaction.account_id];
      if (!account) return {}; // If account does not exist, do nothing.

      // Revert old transaction effect
      let adjustedAmount = account.amount;
      adjustedAmount = prevTransaction.is_credit
        ? adjustedAmount - prevTransaction.amount
        : adjustedAmount + prevTransaction.amount;

      // Apply new transaction effect
      adjustedAmount = transaction.is_credit
        ? adjustedAmount + transaction.amount
        : adjustedAmount - transaction.amount;

      return {
        transactions: {
          ...state.transactions,
          [transaction.id]: transaction,
        },
        accounts: {
          ...state.accounts,
          [transaction.account_id]: { ...account, amount: adjustedAmount },
        },
      };
    }),

  updateCategories: (category) =>
    set((state) => ({
      categories: {
        ...state.categories,
        [category.id]: { ...state.categories[category.id], ...category },
      },
    })),

  // Deleters
  deleteTransaction: (transactionId) =>
    set((state) => {
      const transaction = state.transactions[transactionId];
      if (!transaction) return {}; // If transaction does not exist, do nothing.

      const account = state.accounts[transaction.account_id];
      if (!account) return {}; // If account does not exist, do nothing.

      // Reverse the transaction effect
      const newAmount = transaction.is_credit
        ? account.amount - transaction.amount
        : account.amount + transaction.amount;

      const { [transactionId]: _, ...remainingTransactions } =
        state.transactions;

      return {
        transactions: remainingTransactions,
        accounts: {
          ...state.accounts,
          [transaction.account_id]: { ...account, amount: newAmount },
        },
      };
    }),

  deleteAccount: (accountId) =>
    set((state) => ({
      accounts: {
        ...state.accounts,
        [accountId]: {
          ...state.accounts[accountId],
          is_deleted: true,
        },
      },
    })),

  deleteCategory: (categoryId) =>
    set((state) => ({
      categories: {
        ...state.categories,
        [categoryId]: {
          ...state.categories[categoryId],
          is_deleted: true,
        },
      },
    })),

  // Selectors
  getAccountById: (id) => {
    const accounts = get().accounts;
    return accounts[id];
  },
  getAppconstantByKey: (key) => {
    const appconstant = get().appconstants;
    return appconstant[key];
  },
  getCategoryById: (id) => {
    const categories = get().categories;
    return categories[id];
  },
  getAllTransactionsArray: () => {
    const transactions = get().transactions;
    return Object.values(transactions);
  },
  getAllCategoriesArray: () => {
    const categories = get().categories;
    return Object.values(categories);
  },
  getAllAccountsArray: () => {
    const accounts = get().accounts;
    return Object.values(accounts);
  },
}));

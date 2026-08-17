import { Account } from "../types/entity/Account";
import { Appconstant } from "../types/entity/Appconstant";
import { Category } from "../types/entity/Category";
import { Transaction } from "../types/entity/Transaction";
import { create } from "zustand";
import { UserBalance } from "../types/entity/UserBalance";
import { CategoryBudget } from "../types/entity/CategoryBudget";
import { NotificationRow } from "../types/entity/Notification";
import { Fund } from "../types/entity/Fund";

interface ExpensifyState {
  accounts: Record<number, Account>;
  categories: Record<number, Category>;
  transactions: Record<number, Transaction>;
  appconstants: Record<string, Appconstant>;
  userbalances: Record<string, UserBalance>;
  categoryBudgets: Record<number, CategoryBudget>;
  notifications: Record<string, NotificationRow>;
  unreadNotificationCount: number;
  funds: Record<string, Fund>;
  userId: string;
  userEmail: string;
  userName: string;
  // Earliest date currently guaranteed to be loaded into `transactions`
  // (e.g. "6 months ago" after initial load). Null until first loaded.
  transactionsLoadedSince: string | null;
  // Setters
  setAccounts: (accounts: Account[]) => void;
  setAppconstants: (appcontants: Appconstant[]) => void;
  setCategories: (categories: Category[]) => void;
  setTransactions: (transactions: Transaction[]) => void;
  mergeTransactions: (transactions: Transaction[]) => void;
  setTransactionsLoadedSince: (date: string) => void;
  setUserBalances: (userbalances: UserBalance[]) => void;
  setUserId: (id: string) => void;
  setUserEmail: (email: string) => void;
  setUserName: (name: string) => void;
  setCategoryBudgets: (budgets: CategoryBudget[]) => void;
  upsertCategoryBudget: (budget: CategoryBudget) => void;
  deleteCategoryBudget: (categoryId: number) => void;
  getCategoryBudget: (categoryId: number) => CategoryBudget | undefined;
  setNotifications: (notifications: NotificationRow[]) => void;
  mergeNotifications: (notifications: NotificationRow[]) => void;
  markNotificationReadLocal: (id: string) => void;
  setUnreadNotificationCount: (count: number) => void;
  setFunds: (funds: Fund[]) => void;
  mergeFunds: (funds: Fund[]) => void;
  removeFundLocal: (id: string) => void;
  // Adders
  addTransaction: (transaction: Transaction) => void;
  addAccount: (account: Account) => void;
  addCategory: (category: Category) => void;
  addAppconstant: (appconstant: Appconstant) => void;
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
  getTransactionById: (id: number) => Transaction | undefined;
  getAppconstantByKey: (key: string) => Appconstant | undefined;
  getAllTransactionsArray: () => Transaction[];
  getAllCategoriesArray: () => Category[];
  getAllAccountsArray: () => Account[];
  getUserId: () => string;
  getUserEmail: () => string;
  getUserName: () => string;
}

export const useExpensifyStore = create<ExpensifyState>((set, get) => ({
  accounts: {},
  categories: {},
  transactions: {},
  appconstants: {},
  userbalances: {},
  categoryBudgets: {},
  notifications: {},
  unreadNotificationCount: 0,
  funds: {},
  userId: "",
  userEmail: "",
  userName: "",
  transactionsLoadedSince: null,

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
  mergeTransactions: (transactions) =>
    set((state) => {
      const merged = { ...state.transactions };
      transactions.forEach((transaction) => {
        merged[transaction.id] = transaction;
      });
      return { transactions: merged };
    }),
  setTransactionsLoadedSince: (date) =>
    set(() => ({
      transactionsLoadedSince: date,
    })),
  setUserBalances: (userbalances) =>
    set((state) => ({
      userbalances: userbalances.reduce(
        (acc, userbalance) => {
          acc[userbalance.id] = userbalance;
          return acc;
        },
        {} as Record<string, UserBalance>,
      ),
    })),
  setUserId: (id) =>
    set((state) => ({
      userId: id,
    })),
    setUserEmail: (email) =>
    set((state) => ({
      userEmail: email,
    })),
  setUserName: (name) =>
    set((state) => ({
      userName: name,
    })),
  setCategoryBudgets: (budgets) =>
    set(() => ({
      categoryBudgets: budgets.reduce(
        (acc, budget) => {
          acc[budget.category_id] = budget;
          return acc;
        },
        {} as Record<number, CategoryBudget>,
      ),
    })),
  upsertCategoryBudget: (budget) =>
    set((state) => ({
      categoryBudgets: {
        ...state.categoryBudgets,
        [budget.category_id]: budget,
      },
    })),
  deleteCategoryBudget: (categoryId) =>
    set((state) => {
      const { [categoryId]: _, ...remaining } = state.categoryBudgets;
      return { categoryBudgets: remaining };
    }),
  setNotifications: (notifications) =>
    set(() => ({
      notifications: notifications.reduce(
        (acc, n) => {
          acc[n.id] = n;
          return acc;
        },
        {} as Record<string, NotificationRow>,
      ),
    })),
  mergeNotifications: (notifications) =>
    set((state) => {
      const merged = { ...state.notifications };
      notifications.forEach((n) => {
        merged[n.id] = n;
      });
      return { notifications: merged };
    }),
  markNotificationReadLocal: (id) =>
    set((state) => {
      const existing = state.notifications[id];
      if (!existing) return {};
      return {
        notifications: {
          ...state.notifications,
          [id]: { ...existing, read_at: new Date().toISOString() },
        },
      };
    }),
  setUnreadNotificationCount: (count) =>
    set(() => ({ unreadNotificationCount: count })),
  setFunds: (funds) =>
    set(() => ({
      funds: funds.reduce(
        (acc, f) => {
          acc[f.id] = f;
          return acc;
        },
        {} as Record<string, Fund>,
      ),
    })),
  mergeFunds: (funds) =>
    set((state) => {
      const merged = { ...state.funds };
      funds.forEach((f) => {
        merged[f.id] = f;
      });
      return { funds: merged };
    }),
  removeFundLocal: (id) =>
    set((state) => {
      const { [id]: _, ...remaining } = state.funds;
      return { funds: remaining };
    }),
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

  addAppconstant: (appconstant) =>
    set((state) => ({
      appconstants: { ...state.appconstants, [appconstant.key]: appconstant },
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

      const oldAccount = state.accounts[prevTransaction.account_id];
      const newAccount = state.accounts[transaction.account_id];
      
      if (!oldAccount || !newAccount) return {}; // If either account does not exist, do nothing.

      let updatedAccounts;

      if (prevTransaction.account_id === transaction.account_id) {
        // Same account: combine both effects
        let adjustedAmount = oldAccount.amount;
        
        // Revert old transaction effect
        adjustedAmount = prevTransaction.is_credit
          ? adjustedAmount - prevTransaction.amount
          : adjustedAmount + prevTransaction.amount;

        // Apply new transaction effect
        adjustedAmount = transaction.is_credit
          ? adjustedAmount + transaction.amount
          : adjustedAmount - transaction.amount;

        updatedAccounts = {
          ...state.accounts,
          [transaction.account_id]: { ...oldAccount, amount: adjustedAmount },
        };
      } else {
        // Different accounts: update both separately
        const oldAccountNewAmount = prevTransaction.is_credit
          ? oldAccount.amount - prevTransaction.amount
          : oldAccount.amount + prevTransaction.amount;

        const newAccountNewAmount = transaction.is_credit
          ? newAccount.amount + transaction.amount
          : newAccount.amount - transaction.amount;

        updatedAccounts = {
          ...state.accounts,
          [prevTransaction.account_id]: { ...oldAccount, amount: oldAccountNewAmount },
          [transaction.account_id]: { ...newAccount, amount: newAccountNewAmount },
        };
      }

      return {
        transactions: {
          ...state.transactions,
          [transaction.id]: transaction,
        },
        accounts: updatedAccounts,
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
  getTransactionById: (id) => {
    const transactions = get().transactions;
    return transactions[id];
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
  getUserId: () => {
    const userId = get().userId;
    return userId;
  },
  getUserEmail: () => {
    const userEmail = get().userEmail;
    return userEmail;
  },
  getUserName: () => {
    return get().userName;
  },
  getCategoryBudget: (categoryId) => {
    return get().categoryBudgets[categoryId];
  },
}));

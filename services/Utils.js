import { PRETTYCOLORS } from "../constants";
import { format, subDays } from "date-fns";
import { COLORS } from "../constants";
import { getAccountById } from "./selectors";
import { formatISODateToLocalDate } from "./_Utils";
const formatAmountWithCommas = (amount, includeDecimals = true) => {
  const formattedAmount = includeDecimals
    ? amount.toFixed(2)
    : Math.round(amount).toString();

  return formattedAmount.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const getFormattedDateWithYear = (date, formatYesterdayAndToday = 1) => {
  const today = new Date();
  const transactionDate = new Date(date);
  if (
    formatYesterdayAndToday == 1 &&
    transactionDate.toDateString() === today.toDateString()
  ) {
    return "Today";
  } else {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (
      formatYesterdayAndToday == 1 &&
      transactionDate.toDateString() === yesterday.toDateString()
    ) {
      return "Yesterday";
    } else {
      const day = transactionDate.getDate();
      const monthIndex = transactionDate.getMonth();
      const year = transactionDate.getFullYear();
      const month = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ][monthIndex];

      const suffix = (day) => {
        if (day === 1 || day === 21 || day === 31) return "st";
        if (day === 2 || day === 22)
          if (day === 3 || day === 23) return "rd";
        return "th";
      };

      return `${day}${suffix(day)} ${month}, ${year}`;
    }
  }
};
const getDateFromDefaultDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const formattedDate = `${year}-${month}-${day}`;
  return formattedDate;
};

const getTransactionsGroupedByCategories = (
  transactions,
  startDate,
  endDate,
) => {
  const filteredTransactions = transactions.filter(
    (transaction) =>
      new Date(transaction.date) >=
      new Date(getDateFromDefaultDate(startDate)) &&
      new Date(transaction.date) <= new Date(getDateFromDefaultDate(endDate)) &&
      transaction.on_record == 1,
  );
  const groupedTransactions = filteredTransactions
    .filter((transaction) => transaction.amount < 0)
    .reduce((acc, cur) => {
      if (!acc[cur.parent_category]) {
        acc[cur.parent_category] = {
          label: cur.parent_category,
          sum: Math.abs(cur.amount),
          color: PRETTYCOLORS[Object.keys(acc).length % PRETTYCOLORS.length],
        };
      } else {
        acc[cur.parent_category].sum += Math.abs(cur.amount);
      }
      return acc;
    }, {});
  const totalSum = filteredTransactions
    .filter((transaction) => transaction.amount < 0)
    .reduce((acc, cur) => acc + Math.abs(cur.amount), 0);
  for (let category in groupedTransactions) {
    groupedTransactions[category].value = Number(
      ((groupedTransactions[category].sum / totalSum) * 100).toFixed(1),
    );
  }
  const result = Object.values(groupedTransactions);
  return result;
};

const getTransactionsGroupedBySubategories = (
  transactions,
  startDate,
  endDate,
  category,
) => {
  const filteredTransactions = transactions.filter(
    (transaction) =>
      new Date(transaction.date) >=
      new Date(getDateFromDefaultDate(startDate)) &&
      new Date(transaction.date) <= new Date(getDateFromDefaultDate(endDate)) &&
      transaction.on_record == 1 &&
      transaction.parent_category == category,
  );
  const groupedTransactions = filteredTransactions
    .filter((transaction) => transaction.amount < 0)
    .reduce((acc, cur) => {
      if (!acc[cur.category]) {
        acc[cur.category] = {
          label: cur.category,
          sum: Math.abs(cur.amount),
          color: PRETTYCOLORS[Object.keys(acc).length % PRETTYCOLORS.length],
        };
      } else {
        acc[cur.category].sum += Math.abs(cur.amount);
      }
      return acc;
    }, {});
  const totalSum = filteredTransactions
    .filter((transaction) => transaction.amount < 0)
    .reduce((acc, cur) => acc + Math.abs(cur.amount), 0);
  for (let category in groupedTransactions) {
    groupedTransactions[category].value = Number(
      ((groupedTransactions[category].sum / totalSum) * 100).toFixed(1),
    );
  }
  const result = Object.values(groupedTransactions);
  return result;
};
const getTransactionsGroupedByBank = (
  transactions,
  accounts,
  startDate,
  endDate,
) => {
  const filteredTransactions = transactions.filter(
    (transaction) =>
      new Date(transaction.date) >=
      new Date(getDateFromDefaultDate(startDate)) &&
      new Date(transaction.date) <= new Date(getDateFromDefaultDate(endDate)),
  );
  const groupedTransactions = filteredTransactions
    .filter((transaction) => !transaction.is_credit)
    .reduce((acc, cur) => {
      if (!acc[getAccountById(accounts, cur.account_id)].name) {
        acc[cur.bank_name] = {
          label: getAccountById(accounts, cur.account_id).name,
          sum: cur.amount,
          color: PRETTYCOLORS[Object.keys(acc).length % PRETTYCOLORS.length],
        };
      } else {
        acc[getAccountById(accounts, cur.account_id)].sum += cur.amount;
      }
      return acc;
    }, {});

  const totalSum = filteredTransactions
    .filter((transaction) => !transaction.is_credit)
    .reduce((acc, cur) => acc + cur.amount, 0);

  for (let bankName in groupedTransactions) {
    groupedTransactions[bankName].value = Number(
      ((groupedTransactions[bankName].sum / totalSum) * 100).toFixed(1),
    );
  }

  const result = Object.values(groupedTransactions);
  return result;
};

const getNumberOfTransactionsBetweenDates = (
  transactions,
  startDate,
  endDate,
) => {
  const filteredTransactions = transactions.filter(
    (transaction) =>
      new Date(transaction.date) >=
      new Date(getDateFromDefaultDate(startDate)) &&
      new Date(transaction.date) <= new Date(getDateFromDefaultDate(endDate)) &&
      transaction.on_record == 1,
  );
  const result = filteredTransactions.length;
  return result;
};
const getNumberOfSubcategoryTransactionsBetweenDates = (
  transactions,
  startDate,
  endDate,
  category,
) => {
  const filteredTransactions = transactions.filter(
    (transaction) =>
      new Date(transaction.date) >=
      new Date(getDateFromDefaultDate(startDate)) &&
      new Date(transaction.date) <= new Date(getDateFromDefaultDate(endDate)) &&
      transaction.on_record == 1 &&
      transaction.parent_category == category,
  );
  const result = filteredTransactions.length;
  return result;
};
const getTransactionBetweenDates = (transactions, startDate, endDate) => {
  const filteredTransactions = transactions.filter(
    (transaction) =>
      new Date(transaction.date) >=
      new Date(getDateFromDefaultDate(startDate)) &&
      new Date(transaction.date) <= new Date(getDateFromDefaultDate(endDate)),
  );
  return filteredTransactions;
};

const getCumulativeExpenditures = (transactions, startDate, endDate) => {
  let currentDate = new Date(startDate);
  const endDateObj = new Date(endDate);

  let cumulativeAmount = 0;
  let cumulativeExpenditures = [];
  const dateString = getDateFromDefaultDate(currentDate);
  cumulativeExpenditures.push({ date: dateString, value: 0 });
  while (currentDate <= endDateObj) {
    const dateString = getDateFromDefaultDate(currentDate);
    const transactionsForDate = transactions.filter(
      (transaction) =>
        transaction.date === dateString &&
        transaction.amount < 0 &&
        transaction.on_record == 1,
    );
    transactionsForDate.forEach((transaction) => {
      cumulativeAmount += Math.abs(transaction.amount);
    });
    cumulativeExpenditures.push({ date: dateString, value: cumulativeAmount });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return cumulativeExpenditures;
};

const getCumulativeLimit = (monthlyBalance, startDate, endDate) => {
  const dailyLimit = Number((monthlyBalance / 30).toFixed(1));
  let currentDate = new Date(startDate);
  const endDateObj = new Date(endDate);
  let cumulativeAmount = 0;
  let cumulativeLimit = [];
  const dateString = getDateFromDefaultDate(currentDate);
  cumulativeLimit.push({ date: dateString, value: 0 });
  while (currentDate <= endDateObj) {
    const dateString = getDateFromDefaultDate(currentDate);
    cumulativeAmount += dailyLimit;
    cumulativeAmount = Number(cumulativeAmount.toFixed(1));
    cumulativeLimit.push({ date: dateString, value: cumulativeAmount });
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return cumulativeLimit;
};
const getTopTransaction = (transactions, startDate, endDate) => {
  const filteredTransactions = transactions.filter(
    (transaction) =>
      new Date(transaction.date) >=
      new Date(getDateFromDefaultDate(startDate)) &&
      new Date(transaction.date) <= new Date(getDateFromDefaultDate(endDate)) &&
      transaction.amount <= 0 &&
      transaction.on_record == 1,
  );
  const sortedTransactions = filteredTransactions.sort(
    (a, b) => Math.abs(b.amount) - Math.abs(a.amount),
  );

  return sortedTransactions.slice(0, 5);
};
const getTopCategoryTransaction = (
  transactions,
  startDate,
  endDate,
  category,
) => {
  const filteredTransactions = transactions.filter(
    (transaction) =>
      new Date(transaction.date) >=
      new Date(getDateFromDefaultDate(startDate)) &&
      new Date(transaction.date) <= new Date(getDateFromDefaultDate(endDate)) &&
      transaction.amount <= 0 &&
      transaction.on_record == 1 &&
      transaction.parent_category == category,
  );
  const sortedTransactions = filteredTransactions.sort(
    (a, b) => Math.abs(b.amount) - Math.abs(a.amount),
  );

  return sortedTransactions.slice(0, 5);
};
const calculateNextDate = (dateString, frequency) => {
  const [year, month, day] = dateString.split("-").map(Number);
  let date = new Date(year, month - 1, day);
  switch (frequency) {
    case "Every day":
      date.setDate(date.getDate() + 1);
      break;
    case "Every week":
      date.setDate(date.getDate() + 7);
      break;
    case "Every 15 days":
      date.setDate(date.getDate() + 15);
      break;
    case "Every 28 days":
      date.setDate(date.getDate() + 28);
      break;
    case "Every month":
      date.setMonth(date.getMonth() + 1);
      break;
    case "Every 2 months":
      date.setMonth(date.getMonth() + 2);
      break;
    case "Every 3 months":
      date.setMonth(date.getMonth() + 3);
      break;
    case "Every 6 months":
      date.setMonth(date.getMonth() + 6);
      break;
    case "Every year":
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      throw new Error("Invalid frequency");
  }
  return getDateFromDefaultDate(date);
};

const getBarData = (transactions) => {
  const lastSevenDays = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), i);
    return format(date, "yyyy-MM-dd");
  }).reverse();

  const expendituresByDay = lastSevenDays.map((date) => ({
    date,
    total: transactions
      .filter((transaction) => {
        const transactionDate = format(
          new Date(transaction.date_time),
          "yyyy-MM-dd",
        );
        return transactionDate === date && !transaction.is_credit;
      })
      .reduce((sum, transaction) => sum + transaction.amount, 0),
  }));

  const totalExpenditure = expendituresByDay.reduce(
    (sum, day) => sum + day.total,
    0,
  );
  const average = Math.round(totalExpenditure / 7);
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const barData = expendituresByDay.map((day) => ({
    value: day.total,
    label: daysOfWeek[new Date(day.date).getDay()],
    ...(day.total > average ? { frontColor: COLORS.secondary } : {}),
  }));

  return { barData, average };
};

const getTopCategoriesData = (thisMonthTransactions, lastMonthTransactions) => {
  const today = new Date();
  if (thisMonthTransactions.length == 0){
    return [];
  }
  const localDate = new Date(thisMonthTransactions[0].date_time);
  const year = localDate.getFullYear();
  const month = localDate.getMonth();
  const currentDayOfMonth = today.getDate();
  const sumExpendituresByCategory = (transactions) => {
    return transactions.reduce((acc, transaction) => {
      const { category_id, amount, is_credit } = transaction;
      if (!acc[category_id]) {
        acc[category_id] = 0;
      }
      if (!is_credit) acc[category_id] += amount;
      return acc;
    }, {});
  };

  const lastMonthFilteredTransactions = lastMonthTransactions.filter(
    (transaction) => {
      const transactionDate = new Date(transaction.date_time);
      return transactionDate.getDate() <= currentDayOfMonth;
    },
  );

  const thisMonthExpenditures = sumExpendituresByCategory(
    thisMonthTransactions,
  );
  const lastMonthExpenditures = sumExpendituresByCategory(
    lastMonthFilteredTransactions,
  );

  const sortedCategories = Object.keys(thisMonthExpenditures)
    .sort((a, b) => thisMonthExpenditures[b] - thisMonthExpenditures[a])
    .slice(0, 3);
  const flatListData = sortedCategories.map((category_id) => {
    const thisMonthAmount = thisMonthExpenditures[category_id];
    const lastMonthAmount = lastMonthExpenditures[category_id] || 0;
    const change = thisMonthAmount - lastMonthAmount;
    const changePercentage = ((change / lastMonthAmount) * 100).toFixed(2);
    const changeText =
      lastMonthAmount > 0
        ? `${change > 0 ? "+" : ""}${changePercentage}%`
        : `N/A`;

    return {
      key: category_id,
      spent: thisMonthAmount,
      change: changeText,
      lastMonth: lastMonthAmount,
      description: "Featured Category",
      transactions: thisMonthTransactions.filter(
        (transaction) => transaction.category_id == category_id,
      ).length,
      month: month,
      year: year
    };
  });
  return flatListData;
};

const getSubscriptionsDueInNext15Days = (subscriptions) => {
  const currentDate = new Date();
  const next15Days = new Date(currentDate);
  next15Days.setDate(currentDate.getDate() + 15);

  return subscriptions
    .filter((subscription) => {
      const nextDate = new Date(subscription.next_date);
      return (
        nextDate >= currentDate &&
        nextDate <= next15Days &&
        subscription.amount < 0
      );
    })
    .map((subscription) => {
      const nextDate = new Date(subscription.next_date);
      const timeDiff = nextDate - currentDate;
      const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24)) - 1;

      return {
        subscriptionTitle: subscription.title,
        description: "Upcoming Expense",
        subscriptionAmount: `${formatAmountWithCommas(Math.abs(subscription.amount))}`,
        daysRemaining,
      };
    });
};

export {
  formatAmountWithCommas,
  getFormattedDateWithYear,
  getDateFromDefaultDate,
  getTransactionsGroupedByCategories,
  getTransactionsGroupedByBank,
  getNumberOfTransactionsBetweenDates,
  getCumulativeExpenditures,
  getCumulativeLimit,
  getTopTransaction,
  getTransactionBetweenDates,
  calculateNextDate,
  getTransactionsGroupedBySubategories,
  getNumberOfSubcategoryTransactionsBetweenDates,
  getBarData,
  getTopCategoriesData,
  getSubscriptionsDueInNext15Days,
};

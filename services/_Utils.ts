import { Transaction } from "../types/entity/Transaction";
import { PRETTYCOLORS, COLORS } from "../constants";
import { Account } from "../types/entity/Account";
import { Category } from "../types/entity/Category";
import { TransactionFilter } from "../types/filters/transactionFilter";
import { subDays, format, startOfMonth, endOfMonth } from "date-fns";

const getLocalDateFromISO = (isoString: string) => {
  if (!isoString) return null;
  return format(new Date(isoString), "yyyy-MM-dd");
};

export const formatAmountWithCommas = (
  amount: number,
  includeDecimals: boolean = true,
): string => {
  const formattedAmount = includeDecimals
    ? amount.toFixed(2)
    : Math.round(amount).toString();

  return formattedAmount.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};
export const formatISODateToLocalDate = (isoDate: string): string => {
  const date = new Date(isoDate);
  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "short" });
  const year = date.getFullYear();

  const getOrdinalSuffix = (day: number): string => {
    if (day > 3 && day < 21) return "th";
    const lastDigit = day % 10;
    return lastDigit === 1
      ? "st"
      : lastDigit === 2
        ? "nd"
        : lastDigit === 3
          ? "rd"
          : "th";
  };

  return `${day}${getOrdinalSuffix(day)} ${month}, ${year}`;
};

export const getTransactionsGroupedByCategories = (
  transactions: Transaction[],
  categoriesById: Record<number, Category>,
  startDate: Date,
  edDate: Date,
) => {
  const endDate = new Date(edDate);
  endDate.setDate(endDate.getDate() + 1);
  const filteredTransactions = transactions.filter(
    (transaction) =>
      new Date(transaction.date_time) >= startDate &&
      new Date(transaction.date_time) < endDate,
  );
  const groupedTransactions = filteredTransactions
    .filter((transaction) => !transaction.is_credit)
    .reduce((acc, cur) => {
      if (!acc[cur.category_id]) {
        acc[cur.category_id] = {
          label: categoriesById[cur.category_id].name,
          sum: cur.amount,
          category: categoriesById[cur.category_id],
          color: PRETTYCOLORS[Object.keys(acc).length % PRETTYCOLORS.length],
          startDate: startDate.toISOString(),
          endDate: edDate.toISOString(),
        };
      } else {
        acc[cur.category_id].sum += cur.amount;
      }
      return acc;
    }, {});
  const totalSum = filteredTransactions
    .filter((transaction) => !transaction.is_credit)
    .reduce((acc, cur) => acc + cur.amount, 0);
  for (let category in groupedTransactions) {
    groupedTransactions[category].value = Number(
      ((groupedTransactions[category].sum / totalSum) * 100).toFixed(1),
    );
  }
  const result = Object.values(groupedTransactions);
  return result;
};

export const getTransactionsGroupedByAccount = (
  transactions: Transaction[],
  accountsById: Record<number, Account>,
  startDate: Date,
  edDate: Date,
) => {
  const endDate = new Date(edDate);
  endDate.setDate(endDate.getDate() + 1);
  const filteredTransactions = transactions.filter(
    (transaction) =>
      new Date(transaction.date_time) >= startDate &&
      new Date(transaction.date_time) <= endDate,
  );
  const groupedTransactions = filteredTransactions
    .filter((transaction) => !transaction.is_credit)
    .reduce((acc, cur) => {
      if (!acc[cur.account_id]) {
        acc[cur.account_id] = {
          label: accountsById[cur.account_id].name,
          sum: cur.amount,
          color: PRETTYCOLORS[Object.keys(acc).length % PRETTYCOLORS.length],
        };
      } else {
        acc[cur.account_id].sum += cur.amount;
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

export const getNumberOfTransactionsBetweenDates = (
  transactions: Transaction[],
  startDate: Date,
  edDate: Date,
) => {
  const endDate = new Date(edDate);
  endDate.setDate(endDate.getDate() + 1);
  const filteredTransactions = transactions.filter(
    (transaction) =>
      new Date(transaction.date_time) >= startDate &&
      new Date(transaction.date_time) < endDate,
  );
  const result = filteredTransactions.length;
  return result;
};

export const getCumulativeExpenditures = (
  transactions: Transaction[],
  startDate: Date,
  edDate: Date,
) => {
  const endDate = new Date(edDate);
  endDate.setDate(endDate.getDate() + 1);
  const expenditures: Record<string, number> = {};
  let cumulativeSum = 0;
  for (
    let d = new Date(startDate);
    new Date(getLocalDateFromISO(d.toISOString())) <
    new Date(getLocalDateFromISO(endDate.toISOString()));
    d.setDate(d.getDate() + 1)
  ) {
    expenditures[getLocalDateFromISO(d.toISOString())] = 0;
  }
  transactions.forEach(({ date_time, amount, is_credit }) => {
    if (!is_credit) {
      const transactionDate = getLocalDateFromISO(date_time);
      if (transactionDate in expenditures) {
        expenditures[transactionDate] += amount;
      }
    }
  });
  return Object.entries(expenditures).map(([date, amount]) => {
    cumulativeSum += amount;
    return { date, value: cumulativeSum };
  });
};

export const getTopTransaction = (
  transactions: Transaction[],
  startDate: Date,
  edDate: Date,
) => {
  const endDate = new Date(edDate);
  endDate.setDate(endDate.getDate() + 1);
  const filteredTransactions = transactions.filter(
    (transaction) =>
      new Date(transaction.date_time) >= startDate &&
      new Date(transaction.date_time) <= endDate &&
      !transaction.is_credit,
  );
  const sortedTransactions = filteredTransactions.sort(
    (a, b) => b.amount - a.amount,
  );

  return sortedTransactions.slice(0, 5);
};

export const getTransactionsGroupedBySubategories = (
  transactions: Transaction[],
  categoriesById: Record<number, Category>,
  startDate: Date,
  edDate: Date,
  category: Category,
) => {
  const endDate = new Date(edDate);
  endDate.setDate(endDate.getDate() + 1);
  const filteredTransactions = transactions.filter(
    (transaction) =>
      new Date(transaction.date_time) >= startDate &&
      new Date(transaction.date_time) < endDate &&
      transaction.category_id == category.id,
  );
  const groupedTransactions = filteredTransactions
    .filter((transaction) => !transaction.is_credit)
    .reduce((acc, cur) => {
      if (!acc[cur.subcategory_id]) {
        acc[cur.subcategory_id] = {
          label: cur.subcategory_id
            ? categoriesById[cur.subcategory_id].name
            : categoriesById[cur.category_id].name,
          sum: cur.amount,
          color: PRETTYCOLORS[Object.keys(acc).length % PRETTYCOLORS.length],
        };
      } else {
        acc[cur.subcategory_id].sum += cur.amount;
      }
      return acc;
    }, {});
  const totalSum = filteredTransactions
    .filter((transaction) => !transaction.is_credit)
    .reduce((acc, cur) => acc + cur.amount, 0);
  for (let category in groupedTransactions) {
    groupedTransactions[category].value = Number(
      ((groupedTransactions[category].sum / totalSum) * 100).toFixed(1),
    );
  }
  const result = Object.values(groupedTransactions);
  return result;
};

export const getCumulativeLimit = (
  monthlyBalance: number,
  startDate: Date,
  endDate: Date,
) => {
  const dailyLimit = Number((monthlyBalance / 30).toFixed(1));
  let currentDate = new Date(getLocalDateFromISO(startDate.toISOString()));
  const endDateObj = new Date(getLocalDateFromISO(endDate.toISOString()));
  let cumulativeAmount = dailyLimit;
  let cumulativeLimit = [];
  const dateString = currentDate;
  cumulativeLimit.push({ date: dateString, value: dailyLimit });
  while (currentDate <= endDateObj) {
    const dateString = currentDate;
    cumulativeAmount += dailyLimit;
    cumulativeAmount = Number(cumulativeAmount.toFixed(1));
    cumulativeLimit.push({ date: dateString, value: cumulativeAmount });
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return cumulativeLimit;
};

export const getNumberOfSubcategoryTransactionsBetweenDates = (
  transactions: Transaction[],
  startDate: Date,
  edDate: Date,
  category: Category,
) => {
  const endDate = new Date(edDate);
  endDate.setDate(endDate.getDate() + 1);
  const filteredTransactions = transactions.filter(
    (transaction) =>
      new Date(transaction.date_time) >= startDate &&
      new Date(transaction.date_time) < endDate &&
      transaction.category_id == category.id,
  );
  const result = filteredTransactions.length;
  return result;
};

export const getMonthRange = (
  year: number,
  month: number,
): { firstDate: Date; lastDate: Date } => {
  const firstDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0);

  const lastDate = new Date(endDate);
  lastDate.setDate(endDate.getDate() + 1);
  return { firstDate, lastDate };
};

export const filterTransactions = (
  transactions: Transaction[],
  filter: TransactionFilter,
): Transaction[] => {
  return transactions.filter((transaction) => {
    if (
      filter.startDate &&
      new Date(transaction.date_time) < new Date(filter.startDate)
    ) {
      return false;
    }
    if (
      filter.endDate &&
      new Date(transaction.date_time) > new Date(filter.endDate)
    ) {
      return false;
    }
    if (
      filter.categoryIds &&
      !filter.categoryIds.includes(transaction.category_id)
    ) {
      return false;
    }
    if (
      filter.subcategoryIds &&
      !filter.subcategoryIds.includes(transaction.subcategory_id)
    ) {
      return false;
    }
    if (
      filter.accountIds &&
      !filter.accountIds.includes(transaction.account_id)
    ) {
      return false;
    }
    if (
      filter.is_credit !== undefined &&
      transaction.is_credit !== filter.is_credit
    ) {
      return false;
    }
    return true;
  });
};

export const getBarData = (
  transactions: Transaction[],
  mode: "weekly" | "monthly",
  monthIndex?: number,
  year?: number,
) => {
  const today = new Date();
  const selectedYear = year ?? today.getFullYear();
  const selectedMonth =
    typeof monthIndex === "number" ? monthIndex : today.getMonth(); // Default to current month

  let dateRange: string[] = [];
  const { firstDate, lastDate } = getMonthRange(year, monthIndex);
  const endDate = subDays(lastDate, 1);
  if (mode === "weekly") {
    dateRange = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(monthIndex == today.getMonth() ? today : endDate, i);
      return format(date, "yyyy-MM-dd");
    }).reverse();
  } else {
    const totalDays = endDate.getDate();
    dateRange = Array.from({ length: totalDays }, (_, i) =>
      format(new Date(selectedYear, selectedMonth, i + 1), "yyyy-MM-dd"),
    );
  }
  const expendituresByDay = dateRange.map((date) => {
    const transactionTotal = transactions
      .filter((transaction) => {
        const transactionDate = format(
          new Date(transaction.date_time),
          "yyyy-MM-dd",
        );
        return (
          transactionDate === date &&
          !transaction.is_credit &&
          new Date(transaction.date_time).getFullYear() === selectedYear
        );
      })
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    return { date, total: transactionTotal };
  });

  const validDaysForAverage = expendituresByDay.filter(
    (day) => new Date(day.date) <= today && firstDate <= new Date(day.date),
  );

  const totalExpenditure = validDaysForAverage.reduce(
    (sum, day) => sum + day.total,
    0,
  );
  const average = validDaysForAverage.length
    ? Math.round(totalExpenditure / validDaysForAverage.length)
    : 0;

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const barData = expendituresByDay.map((day, index) => {
    const isLabeled = mode === "weekly" || index % 5 === 0;

    return {
      value: day.total,
      ...(isLabeled && {
        label:
          mode === "weekly"
            ? daysOfWeek[new Date(day.date).getDay()]
            : format(new Date(day.date), "d"),
      }),
      ...(day.total > average ? { frontColor: COLORS.secondary } : {}),
    };
  });

  return { barData, average };
};

export const getNumberOfDays = (startDate: Date, edDate: Date): number => {
  const endDate = new Date(edDate);
  endDate.setDate(endDate.getDate() + 1);

  const start = new Date(startDate);
  const differenceInMs = endDate.getTime() - start.getTime();
  const numberOfDays = Math.ceil(differenceInMs / (1000 * 60 * 60 * 24));

  return numberOfDays;
};

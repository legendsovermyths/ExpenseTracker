import { Transaction } from "../types/entity/Transaction";
import { PRETTYCOLORS } from "../constants";
import { LIGHT_COLORS } from "../constants/theme";
import { Account } from "../types/entity/Account";
import { Category } from "../types/entity/Category";
import { TransactionFilter } from "../types/filters/transactionFilter";
import { subDays, format, startOfMonth, endOfMonth } from "date-fns";

export const getLocalDateFromISO = (isoString: string) => {
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
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          account: accountsById[cur.account_id],
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
          icon_name:  cur.subcategory_id
            ? categoriesById[cur.subcategory_id].icon_name
            : categoriesById[cur.category_id].icon_name,
          icon_type: cur.subcategory_id
            ? categoriesById[cur.subcategory_id].icon_type
            : categoriesById[cur.category_id].icon_type,
          category_id:cur.subcategory_id
            ? null
            : categoriesById[cur.category_id].id, 
          subcategory_id:cur.subcategory_id
            ? categoriesById[cur.subcategory_id].id
            : null, 
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
      ...(day.total > average ? { frontColor: LIGHT_COLORS.secondary } : {}),
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
export function applyTransactionFilter(
  txns: Transaction[],
  filter: TransactionFilter,
): Transaction[] {
  return txns
    // ≥ startDate
    .filter(
      (t) =>
        !filter.startDate ||
        new Date(t.date_time) >= new Date(filter.startDate),
    )
    // ≤ endDate
    .filter(
      (t) =>
        !filter.endDate || new Date(t.date_time) <= new Date(filter.endDate),
    )
    // accountIds
    .filter(
      (t) =>
        !filter.accountIds?.length ||
        filter.accountIds.includes(t.account_id),
    )
    // categoryIds
    .filter(
      (t) =>
        !filter.categoryIds?.length ||
        filter.categoryIds.includes(t.category_id),
    )
    // subcategoryIds
    .filter(
      (t) =>
        !filter.subcategoryIds?.length ||
        filter.subcategoryIds.includes(t.subcategory_id),
    );
}

/** Sum up income & expenditure from a list of transactions. */
export function computeTotals(txns: Transaction[]): {
  totalIncome: number;
  totalExpenditure: number;
} {
  let totalIncome = 0;
  let totalExpenditure = 0;
  
  txns.forEach((txn) => {
    if (txn.is_credit) {
      totalIncome += Math.abs(txn.amount);
    } else {
      totalExpenditure += Math.abs(txn.amount);
    }
  });
  
  return { totalIncome, totalExpenditure };
}

export const getMonthlyTrendForCategory = (
  transactions: Transaction[],
  category: Category,
  monthsBack: number = 12,
) => {
  const currentDate = new Date();
  const monthlyData = [];

  // Generate data for the last N months
  for (let i = monthsBack - 1; i >= 0; i--) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    
    // Filter transactions for this month and category
    const monthTransactions = transactions.filter((transaction) => {
      const transactionDate = new Date(transaction.date_time);
      return (
        transactionDate >= monthStart &&
        transactionDate <= monthEnd &&
        transaction.category_id === category.id &&
        !transaction.is_credit
      );
    });
    
    // Calculate total spending for this month
    const monthlySpending = monthTransactions.reduce(
      (sum, transaction) => sum + Math.abs(transaction.amount),
      0
    );
    
    monthlyData.push({
      value: monthlySpending,
      label: format(date, 'MMM'),
      dataPointText: formatAmountWithCommas(monthlySpending, false),
      month: date.getMonth(),
      year: date.getFullYear(),
      transactionCount: monthTransactions.length,
    });
  }
  
  return monthlyData;
};

export const getLastMonthRange = (): { start: Date; end: Date } => {
  const now = new Date();

  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);

  return { start, end };
};

export const getFormattedDate = (dateString: string | Date): string => {
  const today = new Date();
  const transactionDate = new Date(dateString);

  if (transactionDate.toDateString() === today.toDateString()) {
    return "Today";
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (transactionDate.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  const day = transactionDate.getDate();
  const monthIndex = transactionDate.getMonth();
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const month = months[monthIndex];

  const getOrdinalSuffix = (day: number): string => {
    if (day === 1 || day === 21 || day === 31) return "st";
    if (day === 2 || day === 22) return "nd";
    if (day === 3 || day === 23) return "rd";
    return "th";
  };

  return `${day}${getOrdinalSuffix(day)} ${month}`;
};

export const getFormattedDateWithYear = (
  date: string | Date,
  formatYesterdayAndToday: boolean = true
): string => {
  const today = new Date();
  const transactionDate = new Date(date);

  if (formatYesterdayAndToday && transactionDate.toDateString() === today.toDateString()) {
    return "Today";
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (formatYesterdayAndToday && transactionDate.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  const day = transactionDate.getDate();
  const monthIndex = transactionDate.getMonth();
  const year = transactionDate.getFullYear();
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const month = months[monthIndex];

  const getOrdinalSuffix = (day: number): string => {
    if (day === 1 || day === 21 || day === 31) return "st";
    if (day === 2 || day === 22) return "nd";
    if (day === 3 || day === 23) return "rd";
    return "th";
  };

  return `${day}${getOrdinalSuffix(day)} ${month}, ${year}`;
};

export const getDateFromDefaultDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getTopCategoriesData = (
  thisMonthTransactions: Transaction[],
  lastMonthTransactions: Transaction[]
) => {
  const today = new Date();

  if (thisMonthTransactions.length === 0) {
    return [];
  }

  const localDate = new Date(thisMonthTransactions[0].date_time);
  const year = localDate.getFullYear();
  const month = localDate.getMonth();
  const currentDayOfMonth = today.getDate();

  const sumExpendituresByCategory = (transactions: Transaction[]) => {
    return transactions.reduce((acc, transaction) => {
      const { category_id, amount, is_credit } = transaction;
      if (!acc[category_id]) {
        acc[category_id] = 0;
      }
      if (!is_credit) acc[category_id] += amount;
      return acc;
    }, {} as Record<number, number>);
  };

  const lastMonthFilteredTransactions = lastMonthTransactions.filter(
    (transaction) => {
      const transactionDate = new Date(transaction.date_time);
      return transactionDate.getDate() <= currentDayOfMonth;
    }
  );

  const thisMonthExpenditures = sumExpendituresByCategory(thisMonthTransactions);
  const lastMonthExpenditures = sumExpendituresByCategory(lastMonthFilteredTransactions);

  const sortedCategories = Object.keys(thisMonthExpenditures)
    .sort((a, b) => thisMonthExpenditures[Number(b)] - thisMonthExpenditures[Number(a)])
    .slice(0, 5);

  const flatListData = sortedCategories.map((category_id) => {
    const categoryIdNum = Number(category_id);
    const thisMonthAmount = thisMonthExpenditures[categoryIdNum];
    const lastMonthAmount = lastMonthExpenditures[categoryIdNum] || 0;
    const change = thisMonthAmount - lastMonthAmount;
    const changePercentage = ((change / lastMonthAmount) * 100).toFixed(2);
    const changeText =
      lastMonthAmount > 0
        ? `${change > 0 ? "+" : ""}${changePercentage}%`
        : `N/A`;

    return {
      key: categoryIdNum,
      spent: thisMonthAmount,
      change: changeText,
      lastMonth: lastMonthAmount,
      description: "Featured Category",
      transactions: thisMonthTransactions.filter(
        (transaction) => transaction.category_id === categoryIdNum
      ).length,
      month: month,
      year: year
    };
  });

  return flatListData;
};

export const calculateNextDate = (dateString: string, frequency: string): string => {
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

export const getSubscriptionsDueInNext15Days = (subscriptions: Transaction[]) => {
  const currentDate = new Date();
  const next15Days = new Date(currentDate);
  next15Days.setDate(currentDate.getDate() + 15);

  return subscriptions
    .filter((subscription) => {
      const nextDate = new Date(subscription.date_time);
      return (
        nextDate >= currentDate &&
        nextDate <= next15Days &&
        !subscription.is_credit
      );
    })
    .map((subscription) => {
      const nextDate = new Date(subscription.date_time);
      const timeDiff = nextDate.getTime() - currentDate.getTime();
      const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24)) - 1;

      return {
        subscriptionTitle: subscription.description || '',
        description: "Upcoming Expense",
        subscriptionAmount: `${formatAmountWithCommas(Math.abs(subscription.amount))}`,
        daysRemaining,
      };
    });
};

export const getTransactionBetweenDates = (
  transactions: Transaction[],
  startDate: Date,
  endDate: Date
): Transaction[] => {
  const startDateStr = getDateFromDefaultDate(startDate);
  const endDateStr = getDateFromDefaultDate(endDate);

  return transactions.filter((transaction) => {
    const transactionDate = getLocalDateFromISO(transaction.date_time);
    return transactionDate >= startDateStr && transactionDate <= endDateStr;
  });
};

export const getTopCategoryTransaction = (
  transactions: Transaction[],
  startDate: Date,
  endDate: Date,
  categoryId: number
): Transaction[] => {
  const startDateStr = getDateFromDefaultDate(startDate);
  const endDateStr = getDateFromDefaultDate(endDate);

  const filteredTransactions = transactions.filter((transaction) => {
    const transactionDate = getLocalDateFromISO(transaction.date_time);
    return (
      transactionDate >= startDateStr &&
      transactionDate <= endDateStr &&
      !transaction.is_credit &&
      transaction.category_id === categoryId
    );
  });

  const sortedTransactions = filteredTransactions.sort(
    (a, b) => Math.abs(b.amount) - Math.abs(a.amount)
  );

  return sortedTransactions.slice(0, 5);
};

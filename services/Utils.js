import { transactions } from "../constants/icons";
import { PRETTYCOLORS } from "../constants";
const formatAmountWithCommas = (amount) => {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

const getFormattedDateWithYear = (date, formatYesterdayAndToday=1) => {
    const today = new Date();
    const transactionDate = new Date(date);
    if (formatYesterdayAndToday==1 && transactionDate.toDateString() === today.toDateString()) {
      return "Today";
    } else {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (formatYesterdayAndToday==1 && transactionDate.toDateString() === yesterday.toDateString()) {
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
          if (day === 2 || day === 22) return "nd";
          if (day === 3 || day === 23) return "rd";
          return "th";
        };
  
        return `${day}${suffix(day)} ${month}, ${year}`;
      }
    }
  };
const getDateFromDefaultDate=(date)=>{
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const formattedDate = `${year}-${month}-${day}`;
  return formattedDate;
}

const getTransactionsGroupedByCategories=(transactions,startDate,endDate)=>{
  const filteredTransactions = transactions.filter(
    (transaction) => new Date(transaction.date) >= new Date(getDateFromDefaultDate(startDate)) && new Date(transaction.date) <=new Date(getDateFromDefaultDate(endDate))
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
  console.log(filteredTransactions);
  const totalSum = filteredTransactions
    .filter((transaction) => transaction.amount < 0)
    .reduce((acc, cur) => acc + Math.abs(cur.amount), 0);
  for (let category in groupedTransactions) {
    groupedTransactions[category].value = Number(
      ((groupedTransactions[category].sum / totalSum) * 100).toFixed(1)
    );
  }
  const result = Object.values(groupedTransactions);
  return result;
}
const getTransactionsGroupedByBank = (transactions, startDate, endDate) => {
  const filteredTransactions = transactions.filter(
    (transaction) => new Date(transaction.date) >= new Date(getDateFromDefaultDate(startDate)) && new Date(transaction.date) <= new Date(getDateFromDefaultDate(endDate))
  );
  const groupedTransactions = filteredTransactions
    .filter((transaction) => transaction.amount < 0)
    .reduce((acc, cur) => {
      if (!acc[cur.bank_name]) {
        acc[cur.bank_name] = {
          label: cur.bank_name,
          sum: Math.abs(cur.amount),
          color: PRETTYCOLORS[Object.keys(acc).length % PRETTYCOLORS.length],
        };
      } else {
        acc[cur.bank_name].sum += Math.abs(cur.amount);
      }
      return acc;
    }, {});
  
  const totalSum = filteredTransactions
    .filter((transaction) => transaction.amount < 0)
    .reduce((acc, cur) => acc + Math.abs(cur.amount), 0);
  
  for (let bankName in groupedTransactions) {
    groupedTransactions[bankName].value = Number(
      ((groupedTransactions[bankName].sum / totalSum) * 100).toFixed(1)
    );
  }
  
  const result = Object.values(groupedTransactions);
  return result;
}

const getNumberOfTransactionsBetweenDates=(transactions,startDate,endDate)=>{
  const filteredTransactions = transactions.filter(
    (transaction) => new Date(transaction.date) >= new Date(getDateFromDefaultDate(startDate)) && new Date(transaction.date) <= new Date(getDateFromDefaultDate(endDate))
  );
  const result=filteredTransactions.length;
  return result
}
export {formatAmountWithCommas, getFormattedDateWithYear, getDateFromDefaultDate, getTransactionsGroupedByCategories,getTransactionsGroupedByBank,getNumberOfTransactionsBetweenDates}
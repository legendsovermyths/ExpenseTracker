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

export {formatAmountWithCommas, getFormattedDateWithYear}
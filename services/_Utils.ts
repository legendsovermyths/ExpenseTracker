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

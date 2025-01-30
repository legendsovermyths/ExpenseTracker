
const formatAmountWithCommas = (amount: number, includeDecimals: boolean = true): string => {
  const formattedAmount = includeDecimals 
    ? amount.toFixed(2)
    : Math.round(amount).toString(); 

  return formattedAmount.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

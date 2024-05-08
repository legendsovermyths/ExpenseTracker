import { calculateNextDate, getDateFromDefaultDate } from "./Utils";
import { addSubscriptionToDatabase,updateSubscriptionInDatabase } from "./dbUtils"
import IconCategoryMapping from "./IconCategoryMapping";
import { addTransaction } from "./TransactionService";

const addSubscription=async (subscriptionWthoutId)=>{
  const id=await addSubscriptionToDatabase(subscriptionWthoutId);
  return id;
}

const handleSubscriptionTransaction = async (subscription, transactions, banks) => {
    let updatedBanks = banks, updatedTransactions = transactions;
    const currentDate = new Date(getDateFromDefaultDate(new Date()));
    while (new Date(subscription.next_date) <= currentDate) {
        console.log(subscription.next_date, currentDate);
        const transaction = {
            amount: subscription.amount,
            title: subscription.title,
            on_record: subscription.on_record,
            bank_name: subscription.bank_name,
            date: subscription.next_date,
            category: subscription.category,
            icon: IconCategoryMapping[subscription.category],
        };
        const result = await addTransaction(transaction, updatedTransactions, updatedBanks);
        updatedTransactions = result.updatedTransactions;
        updatedBanks = result.updatedBanks;
        subscription.last_date = subscription.next_date;
        subscription.next_date = calculateNextDate(subscription.next_date, subscription.frequency);
    }
    await updateSubscriptionInDatabase(subscription);
    return { updatedTransactions, updatedBanks, subscription};
}

export {addSubscription, handleSubscriptionTransaction}
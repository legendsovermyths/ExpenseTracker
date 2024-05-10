import { calculateNextDate, getDateFromDefaultDate } from "./Utils";
import { addSubscriptionToDatabase,deleteSubscriptionFromDatabase,updateSubscriptionInDatabase } from "./dbUtils"
import IconCategoryMapping from "./IconCategoryMapping";
import { addTransaction } from "./TransactionService";
import { subscription, transactions } from "../constants/icons";

const addSubscription=async (subscriptionWthoutId, subscriptions)=>{
  const id = await addSubscriptionToDatabase(subscriptionWthoutId);
  console.log(id);
  const newSubscriptionWithId={...subscriptionWthoutId,id:id}
  const updatedSubscriptions = [...subscriptions,newSubscriptionWithId]
  return updatedSubscriptions;
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
const addSubscriptionsToTransactions = async (subscriptions, transactions, banks) => {
    let updatedTransactions = transactions;
    let updatedBanks = banks;
    let updatedSubscriptions = [];

    for (let i = 0; i < subscriptions.length; i++) {
        const subscription = subscriptions[i];
        const result = await handleSubscriptionTransaction(subscription, updatedTransactions, updatedBanks);
        updatedTransactions = result.updatedTransactions;
        updatedBanks = result.updatedBanks;
        updatedSubscriptions.push(result.subscription);
    }

    return { updatedTransactions, updatedBanks, updatedSubscriptions };
};

const deleteSubscription=async(id, subscriptions)=>{
    const updatedSubscriptions = subscriptions.filter(subscription => subscription.id !== id);
    await deleteSubscriptionFromDatabase(id);
    return updatedSubscriptions
}
export {addSubscription, addSubscriptionsToTransactions,deleteSubscription}
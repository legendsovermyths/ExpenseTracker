import { calculateNextDate, getDateFromDefaultDate } from "./Utils";
import {
  addSubscriptionToDatabase,
  deleteSubscriptionFromDatabase,
  updateSubscriptionInDatabase,
} from "./DbUtils";
import { addTransaction } from "./TransactionService";

const addSubscription = async (subscriptionWthoutId, subscriptions) => {
  const id = await addSubscriptionToDatabase(subscriptionWthoutId);
  const newSubscriptionWithId = { ...subscriptionWthoutId, id: id };
  const updatedSubscriptions = [...subscriptions, newSubscriptionWithId];
  return updatedSubscriptions;
};

const handleSubscriptionTransaction = async (
  subscription,
  transactions,
  banks,
  categories,
) => {
  let updatedBanks = banks;
  let updatedTransactions = transactions;
  const currentDate = new Date(getDateFromDefaultDate(new Date()));
  while (new Date(subscription.next_date) <= currentDate) {
    const transaction = {
      amount: subscription.amount,
      title: subscription.title,
      on_record: subscription.on_record,
      bank_name: subscription.bank_name,
      date: subscription.next_date,
      category: subscription.category,
      icon_name: categories[subscription.category].icon_name,
      icon_type: categories[subscription.category].icon_type,
      category_id: subscription.category,
    };
    const result = await addTransaction(
      transaction,
      updatedTransactions,
      updatedBanks,
    );
    updatedTransactions = result.updatedTransactions;
    updatedBanks = result.updatedBanks;
    subscription.last_date = subscription.next_date;
    subscription.next_date = calculateNextDate(
      subscription.next_date,
      subscription.frequency,
    );
  }
  await updateSubscriptionInDatabase(subscription);
  return { updatedTransactions, updatedBanks, subscription };
};
const addSubscriptionsToTransactions = async (
  subscriptions,
  transactions,
  banks,
  categories,
) => {
  let updatedTransactions = transactions;
  let updatedBanks = banks;
  let updatedSubscriptions = [];

  for (let i = 0; i < subscriptions.length; i++) {
    const subscription = subscriptions[i];
    const result = await handleSubscriptionTransaction(
      subscription,
      updatedTransactions,
      updatedBanks,
      categories,
    );
    updatedTransactions = result.updatedTransactions;
    updatedBanks = result.updatedBanks;
    updatedSubscriptions.push(result.subscription);
  }

  return { updatedTransactions, updatedBanks, updatedSubscriptions };
};

const deleteSubscription = async (id, subscriptions) => {
  const updatedSubscriptions = subscriptions.filter(
    (subscription) => subscription.id !== id,
  );
  await deleteSubscriptionFromDatabase(id);
  return updatedSubscriptions;
};
export { addSubscription, addSubscriptionsToTransactions, deleteSubscription };

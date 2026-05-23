const subscriptionFrequency: readonly string[] = [
  "Every day",
  "Every week",
  "Every 15 days",
  "Every 28 days",
  "Every month",
  "Every 2 months",
  "Every 3 months",
  "Every 6 months",
  "Every year",
] as const;

export type SubscriptionFrequencyType = typeof subscriptionFrequency[number];

export default subscriptionFrequency;

const categories: readonly string[] = [
  "Food",
  "Housing",
  "Healthcare",
  "Shopping",
  "Others",
  "Entertainment",
  "Transport",
  "Personal",
  "Utilities",
] as const;

export type CategoryType = typeof categories[number];

export default categories;

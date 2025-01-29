import { Account } from "../types/entity/Account";
import { Category } from "../types/entity/Category";

export function getMainCategories(categories: Category[]): Category[] {
  return categories.filter(
    (category) => !category.is_subcategory && !category.is_deleted,
  );
}

export function getAccountById(accounts: Account[], id: Number): Account | undefined {
  return accounts.find(account => account.id === id);
}

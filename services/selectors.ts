import categories from "../constants/category";
import { Account } from "../types/entity/Account";
import { Category } from "../types/entity/Category";

export function getMainCategories(categories: Category[]): Category[] {
  return categories.filter(
    (category) => !category.is_subcategory && !category.is_deleted,
  );
}

export function getSubcategories(
  categories: Category[],
  id: Number,
): Category[] {
  return categories.filter(
    (category) => !category.is_deleted && category.parent_category == id,
  );
}
export function getAccountById(
  accounts: Account[],
  id: Number,
): Account | undefined {
  return accounts.find((account) => account.id === id);
}

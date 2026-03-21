import {
  Action,
  AddCategoryPayload,
  UpdateCategoryPayload,
  DeleteCategoryPayload,
} from "../types/actions/actions";
import { Category } from "../types/entity/Category";
import { invokeBackend } from "./api";

export const addCategory = async (category: Category) => {
  const addCategoryPayload: AddCategoryPayload = {
    category: category,
  };
  let response = await invokeBackend(Action.AddCategory, addCategoryPayload);
  return response.additions.categories[0];
};

export const editCategory = async (category: Category) => {
  const updateCategoryPayload: UpdateCategoryPayload = {
    category: category,
  };
  let response = await invokeBackend(Action.UpdateCategory, updateCategoryPayload);
  return response.updates.categories[0];
};

export const deleteCategory = async (category: Category) => {
  const deleteCategoryPayload: DeleteCategoryPayload = {
    category: category,
  };
  let response = await invokeBackend(
    Action.DeleteCategory,
    deleteCategoryPayload,
  );
};

export function getMainCategories(categories: Category[]): Category[] {
  return categories.filter(
    (category) => !category.is_subcategory && !category.is_deleted,
  );
}

import { Action, AddCategoryPayload } from "../types/actions/actions";
import { Category } from "../types/entity/Category";
import { invokeBackend } from "./api";

export const addCategory = async (category: Category) => {
  const addCategoryPayload: AddCategoryPayload = {
    category: category,
  };
  let response = await invokeBackend(Action.AddCategory, addCategoryPayload);
  return response.additions.categories[0];
};

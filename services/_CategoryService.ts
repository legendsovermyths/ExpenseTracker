import { Action, AddCategoryPayload } from "../types/actions/actions";
import { Category } from "../types/entity/Category";
import { invokeBackend } from "./api";

export const addCategory = async (category: Category) => {
  const addCategoryPayload: AddCategoryPayload = {
    category: category,
  };
  await invokeBackend(Action.AddCategory, addCategoryPayload);
};

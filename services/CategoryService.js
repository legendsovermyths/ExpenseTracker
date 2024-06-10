import {
  addCategoryToDatabase,
  deleteCategoryFromDatabase,
  editCategoryInDatabase,
} from "./DbUtils";

const addCategory = async (newCategory, categories, mainCategories) => {
  let categoryId = await addCategoryToDatabase(newCategory);
  let newCategoryObject = {
    id: categoryId,
    name: newCategory.name,
    icon_name: newCategory.icon_name,
    icon_type: newCategory.icon_type,
    is_subcategory: newCategory.is_subcategory,
    parent_category: newCategory.parent_category,
  };
  let tempUpdatedCategory = categories;
  tempUpdatedCategory[categoryId] = newCategoryObject;
  const updatedCategories = tempUpdatedCategory;
  newCategoryObject = { ...newCategoryObject, name: newCategory.name };
  const updatedMainCategories = [...mainCategories, newCategoryObject];

  return { updatedCategories, updatedMainCategories };
};

const deleteCategory = async (id, mainCategories) => {
  const updatedMainCategories = mainCategories.filter((cat) => cat.id !== id);
  await deleteCategoryFromDatabase(id);
  return updatedMainCategories;
};

const editCategory = async (category, categories) => {
  const updatedCategories = categories.map((cat) =>
    cat.id === category.id ? category : cat
  );
  await editCategoryInDatabase(category);
  return updatedCategories;
};

export { addCategory, deleteCategory, editCategory };

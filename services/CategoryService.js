import {
  addCategoryToDatabase,
  deleteCategoryFromDatabase,
  editCategoryInDatabase,
} from "./DbUtils";

function validateCategoryObject(categoryObject) {
  const categories = Object.values(categoryObject).filter(
    (category) => category.deleted !== 1
  );
  const nonSubcategoryNames = new Set();
  const subcategoryNames = {};

  for (const category of categories) {
    const { is_subcategory, name, parent_category } = category;
    if (is_subcategory === 0) {
      if (nonSubcategoryNames.has(name)) {
        return false;
      }
      nonSubcategoryNames.add(name);
    } else {
      if (!subcategoryNames[parent_category]) {
        subcategoryNames[parent_category] = new Set();
      }
      if (subcategoryNames[parent_category].has(name)) {
        return false;
      }
      subcategoryNames[parent_category].add(name);
    }
  }
  return true;
}

const getCategoryObjectsWithParent = (data, category) => {
  return Object.keys(data)
    .filter(
      (key) =>
        data[key].parent_category === category &&
        data[key].deleted !== 1 &&
        data[key].name != data[key].parent_category
    )
    .map((key, index) => {
      const value = data[key];
      return {
        ...value,
      };
    });
};

function convertAndFilterUndeletedCategories(categoriesObj) {
  return Object.keys(categoriesObj)
    .filter((key) => categoriesObj[key].deleted !== 1)
    .map((key) => {
      return {
        id: key,
        ...categoriesObj[key],
      };
    });
}

function convertAndFilterUndeletedAndMainCategories(categoriesObj) {
  return Object.keys(categoriesObj)
    .filter(
      (key) =>
        categoriesObj[key].deleted !== 1 &&
        categoriesObj[key].is_subcategory === 0
    )
    .map((key) => {
      return {
        id: key,
        ...categoriesObj[key],
      };
    });
}

const addCategory = async (newCategory, categories) => {
  let error = null;
  let tempCategories = { ...categories };
  tempCategories['temp_id'] = newCategory;
  if (validateCategoryObject(tempCategories) === false) {
    error = "Two categories or sub-categories cannot have the same name.";
    return { categories, error };
  }
  let categoryId = await addCategoryToDatabase(newCategory);
  let newCategoryObject = {
    id: categoryId,
    name: newCategory.name,
    icon_name: newCategory.icon_name,
    icon_type: newCategory.icon_type,
    is_subcategory: newCategory.is_subcategory,
    parent_category: newCategory.parent_category,
    deleted: 0
  };

  let tempUpdatedCategory = { ...categories };
  tempUpdatedCategory[categoryId] = newCategoryObject;
  const updatedCategories = { ...tempUpdatedCategory };
  newCategoryObject = { ...newCategoryObject, name: newCategory.name };

  return { updatedCategories, error };
};

const deleteCategory = async (id, categories) => {
  try {
    await deleteCategoryFromDatabase(id);
    let tempCategories = { ...categories };
    tempCategories[id].deleted = 1;
    const updatedCategories = { ...tempCategories };

    return updatedCategories;
  } catch (error) {
    console.error("Failed to delete category from the database:", error);

    throw error;
  }
};

const editCategory = async (category, categories) => {
  let error = null;
  let tempCategories = { ...categories };
  tempCategories[category.id] = category;
  const updatedCategories = { ...tempCategories };
  if (validateCategoryObject(updatedCategories) === false) {
    error = "Two categories or sub-categories cannot have the same name.";
    return { categories, error };
  }

  await editCategoryInDatabase(category);

  return { updatedCategories, error };
};

export {
  addCategory,
  deleteCategory,
  editCategory,
  convertAndFilterUndeletedAndMainCategories,
  convertAndFilterUndeletedCategories,
  getCategoryObjectsWithParent,
};

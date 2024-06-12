import {
  addCategoryToDatabase,
  deleteCategoryFromDatabase,
  editCategoryInDatabase,
} from "./DbUtils";

//TODO:implement check for valie categories object
const getCategoryObjectsWithParent = (data, category) => {
  return Object.keys(data)
    .filter(key => (data[key].parent_category === category && data[key].deleted!==1 && data[key].name!=data[key].parent_category))
    .map((key, index) => {
      const value = data[key];
      return {
        ...value
      };
    });
};

function convertAndFilterUndeletedCategories(categoriesObj) {
    return Object.keys(categoriesObj)
        .filter(key => categoriesObj[key].deleted !== 1)
        .map(key => {
            return {
                id: key,
                ...categoriesObj[key]
            };
        });
}

function convertAndFilterUndeletedAndMainCategories(categoriesObj){
  return Object.keys(categoriesObj)
        .filter(key => (categoriesObj[key].deleted !== 1 && categoriesObj[key].is_subcategory===0) )
        .map(key => {
            return {
                id: key,
                ...categoriesObj[key]
            };
        });
}

const addCategory = async (newCategory, categories) => {
  let categoryId = await addCategoryToDatabase(newCategory);
  let newCategoryObject = {
    id: categoryId,
    name: newCategory.name,
    icon_name: newCategory.icon_name,
    icon_type: newCategory.icon_type,
    is_subcategory: newCategory.is_subcategory,
    parent_category: newCategory.parent_category,
  };

  let tempUpdatedCategory = {...categories};
  tempUpdatedCategory[categoryId] = newCategoryObject;
  const updatedCategories = {...tempUpdatedCategory};
  newCategoryObject = { ...newCategoryObject, name: newCategory.name };

  return  updatedCategories;
};

const deleteCategory = async (id, categories) => {
  try {

    await deleteCategoryFromDatabase(id);
    
 
    let tempCategories = { ...categories };
    tempCategories[id].deleted=1;
    const updatedCategories = {...tempCategories}

    return updatedCategories;
  } catch (error) {
    console.error("Failed to delete category from the database:", error);
    
    throw error; 
  }
};

const editCategory = async (category, categories) => {
  console.log(category);
  let tempCategories = { ...categories };
  tempCategories[category.id] = category;
  const updatedCategories = tempCategories;
  await editCategoryInDatabase(category);
  
  return updatedCategories;
};

export { addCategory, deleteCategory, editCategory, convertAndFilterUndeletedAndMainCategories, convertAndFilterUndeletedCategories, getCategoryObjectsWithParent};

import { addCategoryToDatabase } from "./DbUtils";

const addCategory=async(newCategory,categories, mainCategories)=>{
    let newCategoryObject={icon_name:newCategory.icon_name, icon_type:newCategory.icon_type, is_subcategory:newCategory.is_subcategory, parent_category: newCategory.parent_category};
    let tempUpdatedCategory= categories;
    tempUpdatedCategory[newCategory.name]=newCategoryObject;
    const updatedCategories=tempUpdatedCategory;
    newCategoryObject = {...newCategoryObject, name:newCategory.name}
    const updatedMainCategories=[...mainCategories,newCategoryObject];
    await addCategoryToDatabase(newCategory);
    return {updatedCategories, updatedMainCategories}
}

export {addCategory}
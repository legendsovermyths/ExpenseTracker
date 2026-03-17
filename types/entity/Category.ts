export interface Category{
  id: number,
  name: string,
  icon_name: string,
  icon_type: string,
  is_subcategory: boolean,
  parent_category: number,
  is_deleted: boolean
}

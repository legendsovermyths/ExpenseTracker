export interface Transaction {
  id: number;
  date_time: string;
  description: string;
  amount: number;
  is_credit: boolean;
  bank_id: number;
  category_id: number;
  subcategory_id: number;
}

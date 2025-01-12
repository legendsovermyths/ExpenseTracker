export interface Transaction {
  id: number;
  date_time: string;
  description: string;
  amount: string;
  credit: boolean;
  bank_id: number;
  category_id: number;
  subcategory_id: number;
}

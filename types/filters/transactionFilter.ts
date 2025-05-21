export interface TransactionFilter {
  startDate?: string;
  endDate?: string;
  categoryIds?: number[];
  subcategoryIds?: number[];
  accountIds?: number[];
  label?: string;
  is_credit?: boolean;
}

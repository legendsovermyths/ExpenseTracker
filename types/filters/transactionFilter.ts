export interface TransactionFilter {
  startDate?: string;
  endDate?: string;
  categoryIds?: number[];
  subcategoryIds?: number[];
  accountIds?: number[];
  is_credit?: boolean;
}

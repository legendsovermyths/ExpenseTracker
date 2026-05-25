export interface ParsedTransaction {
  description?: string;
  amount?: number;
  is_credit?: boolean;
  category_id?: number;
  subcategory_id?: number;
  account_id?: number;
  date?: string;        // "YYYY-MM-DD" — omitted when not visible in image
}

export interface ParsedImageResult {
  found: boolean;
  transactions?: ParsedTransaction[];
}

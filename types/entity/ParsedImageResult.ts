export interface ParsedTransaction {
  description?: string;
  amount?: number;
  is_credit?: boolean;
  category_id?: number;
  subcategory_id?: number;
  account_id?: number;
  date?: string;        // "YYYY-MM-DD" — omitted when not visible in image
  // Origin tags (set when flattening a multi-image batch) so each saved txn
  // logs against the image it actually came from. Not part of the LLM output.
  __imageUri?: string;
  __imageHash?: string;
  __llmOutput?: string;
  // Set when the carousel edits existing transactions in bulk (bulkMode 'edit'):
  // the real transaction id so save updates in place instead of inserting.
  id?: number | null;
  // Set when prefilling the add-carousel from selected splits: links the newly
  // created transaction back to its ledger entry on save.
  __entryId?: string;
}

export interface ParsedImageResult {
  found: boolean;
  transactions?: ParsedTransaction[];
  // Stable content hash of the source image. Set by parseImage, not the LLM.
  imageHash?: string;
}

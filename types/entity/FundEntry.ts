export type FundEntryDirection = "CONTRIBUTION" | "WITHDRAWAL";

export interface FundEntry {
  id: string;
  fund_id: string;
  contributor_id: string;
  amount_cents: number;
  direction: FundEntryDirection;
  note?: string;
  linked_transaction_id?: number;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

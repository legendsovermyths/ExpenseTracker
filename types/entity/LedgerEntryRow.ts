export interface LedgerEntryRow {
  id: string;
  kind: string;
  description: string;
  created_by: string;
  total_cents: number;
  updated_at: string;
  trasaction_id: number;
}

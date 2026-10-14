export interface LiWithEntry {
  entry_id: string;
  user_id: string;
  amount_cents: number;
  description: string;
  created_at: string;
  kind: string;
  grp_id?: string | null;
  grp_name?: string | null;
}

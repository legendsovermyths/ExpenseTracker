export interface Fund {
  id: string;
  name: string;
  icon_name?: string;
  icon_type?: string;
  is_shared: boolean;
  owner_id: string;
  other_participant_id?: string;
  other_participant_name?: string;
  target_cents?: number;
  target_date?: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

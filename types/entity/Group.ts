export interface Group {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  icon_name?: string | null;
  icon_type?: string | null;
}

export interface GroupMember {
  grp_id: string;
  user_id: string;
  // Local-only display name, resolved from `profiles` on sync.
  user_name?: string | null;
  joined_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface GroupSummary {
  group: Group;
  members: GroupMember[];
  // Positive ⇒ the group owes me overall.
  my_net_cents: number;
  last_activity_at: string | null;
}

export interface GroupExpense {
  entry_id: string;
  description: string | null;
  created_at: string;
  kind: "SPLIT" | "PAYMENT";
  total_cents: number;
  created_by: string | null;
  transaction_id: number | null;
  is_dirty: boolean;
  my_net_cents: number;
  payer_ids: string[];
}

export interface GroupMemberBalance {
  user_id: string;
  // Positive ⇒ this member owes me.
  net_cents: number;
}

export interface GroupDetail {
  group: Group;
  members: GroupMember[];
  expenses: GroupExpense[];
  member_balances: GroupMemberBalance[];
  my_net_cents: number;
  total_spent_cents: number;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  actor_id: string;
  // JSON-encoded string, shape depends on `type` — parse with JSON.parse
  // when rendering. Kept opaque here so new notification types don't need
  // a type change on this side.
  payload: string;
  created_at: string;
  read_at?: string | null;
}

/**
 * An AI-generated icon: one SVG path on a 24×24 grid, drawn with
 * fill-rule evenodd. Categories, funds and groups reference it with
 * icon_type "custom" and icon_name = id. Mirrors `public.icon`.
 */
export interface IconRow {
  id: string;
  owner_id: string;
  path: string;
  prompt?: string | null;
  created_at: string;
  updated_at?: string | null;
  is_deleted: boolean;
}

export const CUSTOM_ICON_TYPE = "custom";

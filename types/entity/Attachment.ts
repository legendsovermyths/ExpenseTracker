export type AttachmentOwnerType = "TRANSACTION" | "SPLIT";

export const DOC_TYPES = ["BILL", "INVOICE", "RECEIPT", "WARRANTY", "OTHER"] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  BILL: "Bill",
  INVOICE: "Invoice",
  RECEIPT: "Receipt",
  WARRANTY: "Warranty",
  OTHER: "Other",
};

/** Lightweight metadata row — never contains the file content. */
export interface Attachment {
  id: string;
  owner_type: AttachmentOwnerType;
  owner_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  doc_type: DocType | null;
  doc_type_source: "AI" | "USER" | null;
  thumbnail_b64: string | null;
  created_at: string;
}

export interface NewAttachment extends Attachment {
  data_b64: string;
}

export interface AttachmentOwner {
  owner_type: AttachmentOwnerType;
  owner_id: string;
}

export interface DocumentedItem {
  owner_type: AttachmentOwnerType;
  owner_id: string;
  description: string | null;
  amount: number;
  is_credit: boolean;
  date_time: string;
  category_id: number | null;
  counterparty_id: string | null;
  counterparty_name: string | null;
  attachment_count: number;
  doc_types: (DocType | "UNCLASSIFIED")[];
  thumbnail_b64: string | null;
}

export const attachmentOwnerKey = (ownerType: AttachmentOwnerType, ownerId: string | number) =>
  `${ownerType}:${ownerId}`;

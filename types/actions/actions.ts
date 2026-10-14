import { Account } from "../entity/Account";
import { Appconstant } from "../entity/Appconstant";
import { Category } from "../entity/Category";
import { LedgerEntryRow } from "../entity/LedgerEntryRow";
import { LineItemRow } from "../entity/LineItemRow";
import { Transaction } from "../entity/Transaction";
import { UserBalance } from "../entity/UserBalance";
import { CategoryBudget } from "../entity/CategoryBudget";
import { NotificationRow } from "../entity/Notification";
import { Fund } from "../entity/Fund";
import { FundEntry } from "../entity/FundEntry";
import { Group, GroupMember } from "../entity/Group";
import { Friend } from "../entity/Friend";
import { AttachmentOwnerType, DocType, NewAttachment } from "../entity/Attachment";

export enum Action {
  GetTransactions = "get_transactions",
  GetTransactionCount = "get_transaction_count",
  AddTransaction = "add_transaction",
  AddAccount = "add_account",
  AddCategory = "add_category",
  UpdateCategory = "update_category",
  DeleteCategory = "delete_category",
  GetData = "get_data",
  DeleteAccount = "delete_account",
  UpdateAccount = "update_account",
  UpdateTransaction = "update_transaction",
  UpdateUserBalances = "update_user_balances",
  DeleteTransaction = "delete_transaction",
  AddAppconstant = "add_appconstant",
  SyncSplitData = "sync_split_data",
  FetchFriendLedger = "fetch_friend_ledger",
  UpdateAppconstant = "update_appconstant",
  ExportData = "export_data",
  LinkTransactionToLedgerEntry = "link_transaction_to_ledger_entry",
  FetchSplitSummary = "fetch_split_summary",
  DeleteData = "delete_data",
  ImportData = "import_data",
  GetDirtySplitData = "get_dirty_split_data",
  InsertSplitData = "insert_split_data",
  DeleteSplit = "delete_split",
  UpsertCategoryBudget = "upsert_category_budget",
  DeleteCategoryBudget = "delete_category_budget",
  StoreImageParseLog = "store_image_parse_log",
  SyncNotifications = "sync_notifications",
  GetNotifications = "get_notifications",
  MarkNotificationRead = "mark_notification_read",
  GetUnreadNotificationCount = "get_unread_notification_count",
  UpsertFund = "upsert_fund",
  DeleteFund = "delete_fund",
  FetchFunds = "fetch_funds",
  FetchFundDetail = "fetch_fund_detail",
  AddFundEntry = "add_fund_entry",
  UpdateFundEntry = "update_fund_entry",
  DeleteFundEntry = "delete_fund_entry",
  GetDirtyFundData = "get_dirty_fund_data",
  SyncFundData = "sync_fund_data",
  UpsertGroup = "upsert_group",
  DeleteGroup = "delete_group",
  FetchGroups = "fetch_groups",
  FetchGroupDetail = "fetch_group_detail",
  GetDirtyGroupData = "get_dirty_group_data",
  SyncGroupData = "sync_group_data",
  AddFriend = "add_friend",
  DeleteFriend = "delete_friend",
  AddAttachments = "add_attachments",
  ListAttachments = "list_attachments",
  GetAttachmentData = "get_attachment_data",
  UpdateAttachmentType = "update_attachment_type",
  DeleteAttachments = "delete_attachments",
  ListAttachmentOwners = "list_attachment_owners",
  ListDocumentedItems = "list_documented_items",
}

export type Payloads = {
  [Action.AddAttachments]: AddAttachmentsPayload;
  [Action.ListAttachments]: ListAttachmentsPayload;
  [Action.GetAttachmentData]: GetAttachmentDataPayload;
  [Action.UpdateAttachmentType]: UpdateAttachmentTypePayload;
  [Action.DeleteAttachments]: DeleteAttachmentsPayload;
  [Action.ListAttachmentOwners]: ListAttachmentOwnersPayload;
  [Action.ListDocumentedItems]: ListDocumentedItemsPayload;
  [Action.GetTransactions]: GetTransactionsPayload;
  [Action.GetTransactionCount]: GetTransactionCountPayload;
  [Action.AddTransaction]: AddTransactionPayload;
  [Action.AddAccount]: AddAccountPayload;
  [Action.AddCategory]: AddCategoryPayload;
  [Action.GetData]: GetDataPayload;
  [Action.DeleteAccount]: DeleteAccountPayload;
  [Action.UpdateAccount]: UpdateAccountPayload;
  [Action.UpdateCategory]: UpdateCategoryPayload;
  [Action.DeleteCategory]: DeleteCategoryPayload;
  [Action.UpdateTransaction]: UpdateTransactionPayload;
  [Action.UpdateUserBalances]: UpdateUserBalancesPayload;
  [Action.DeleteTransaction]: DeleteTransactionPayload;
  [Action.AddAppconstant]: AddAppconstantPayload;
  [Action.UpdateAppconstant]: UpdateAppconstantPayload;
  [Action.SyncSplitData]: SyncSplitDataPayload;
  [Action.ExportData]: ExportDataPayload;
  [Action.ImportData]: ImportDataPayload;
  [Action.FetchSplitSummary]: FetchSplitSummaryPayload;
  [Action.FetchFriendLedger]: FetchFreindLedgerPayload;
  [Action.DeleteData]: DeleteDataPayload;
  [Action.LinkTransactionToLedgerEntry]: LinkTransactinPayload;
  [Action.InsertSplitData]: InsertSplitDataPayload;
  [Action.GetDirtySplitData]: GetDirtySplitDataPayload;
  [Action.DeleteSplit]: DeleteSplitPayload;
  [Action.UpsertCategoryBudget]: UpsertCategoryBudgetPayload;
  [Action.DeleteCategoryBudget]: DeleteCategoryBudgetPayload;
  [Action.StoreImageParseLog]: StoreImageParseLogPayload;
  [Action.SyncNotifications]: SyncNotificationsPayload;
  [Action.GetNotifications]: GetNotificationsPayload;
  [Action.MarkNotificationRead]: MarkNotificationReadPayload;
  [Action.GetUnreadNotificationCount]: GetUnreadNotificationCountPayload;
  [Action.UpsertFund]: UpsertFundPayload;
  [Action.DeleteFund]: DeleteFundPayload;
  [Action.FetchFunds]: FetchFundsPayload;
  [Action.FetchFundDetail]: FetchFundDetailPayload;
  [Action.AddFundEntry]: AddFundEntryPayload;
  [Action.UpdateFundEntry]: UpdateFundEntryPayload;
  [Action.DeleteFundEntry]: DeleteFundEntryPayload;
  [Action.GetDirtyFundData]: GetDirtyFundDataPayload;
  [Action.SyncFundData]: SyncFundDataPayload;
  [Action.UpsertGroup]: UpsertGroupPayload;
  [Action.DeleteGroup]: DeleteGroupPayload;
  [Action.FetchGroups]: FetchGroupsPayload;
  [Action.FetchGroupDetail]: FetchGroupDetailPayload;
  [Action.GetDirtyGroupData]: GetDirtyGroupDataPayload;
  [Action.SyncGroupData]: SyncGroupDataPayload;
  [Action.AddFriend]: AddFriendPayload;
  [Action.DeleteFriend]: DeleteFriendPayload;
};

export interface SyncSplitDataPayload {
  ledger_entries: LedgerEntryRow[];
  line_items: LineItemRow[];
}

export interface FetchFreindLedgerPayload {
  me_id: string;
  friend_id: string;
  start_date?: string;
  end_date?: string;
}
export interface GetTransactionsPayload {
  start_date?: string;
  end_date?: string;
  search_text?: string;
  limit?: number;
}

export interface GetTransactionCountPayload {}

export interface AddTransactionPayload {
  transaction: Transaction;
}

export interface AddAccountPayload {
  account: Account;
}

export interface AddCategoryPayload {
  category: Category;
}

export interface GetDataPayload {
  transactions_since?: string;
}

export interface DeleteAccountPayload {
  account: Account;
}

export interface UpdateAccountPayload {
  account: Account;
}

export interface UpdateCategoryPayload {
  category: Category;
}

export interface DeleteCategoryPayload {
  category: Category;
}

export interface UpdateTransactionPayload {
  transaction: Transaction;
}

export interface DeleteTransactionPayload {
  transaction: Transaction;
}

export interface AddAppconstantPayload {
  appconstant: Appconstant;
}

export interface UpdateAppconstantPayload {
  appconstant: Appconstant;
}

export interface ExportDataPayload {}

export interface ImportDataPayload {
  // base64-encoded .exp archive
  file: string;
}

export interface DeleteDataPayload {}

export interface UpdateUserBalancesPayload {
  user_balances: UserBalance[];
}

export interface LinkTransactinPayload {
  transaction_id: number;
  ledger_entry_id: string;
}

export interface FetchSplitSummaryPayload {
  entry_id: string;
}

export interface DeleteSplitPayload {
  entry_id: string;
}
export interface InsertSplitDataPayload {
  ledger_entries: LedgerEntryRow[];
  line_items: LineItemRow[];
}

export interface GetDirtySplitDataPayload {}

export interface UpsertCategoryBudgetPayload {
  category_budget: CategoryBudget;
}

export interface DeleteCategoryBudgetPayload {
  category_id: number;
}

export interface StoreImageParseLogPayload {
  image_hash: string;
  llm_raw_output: string;
  transaction_id: number;
}

export interface SyncNotificationsPayload {
  notifications: NotificationRow[];
}

export interface GetNotificationsPayload {
  limit?: number;
}

export interface MarkNotificationReadPayload {
  id: string;
  read_at: string;
}

export interface GetUnreadNotificationCountPayload {}

export interface UpsertFundPayload {
  fund: Fund;
}

export interface DeleteFundPayload {
  fund_id: string;
}

export interface FetchFundsPayload {
  user_id: string;
}

export interface FetchFundDetailPayload {
  fund_id: string;
}

export interface AddFundEntryPayload {
  entry: FundEntry;
}

export interface UpdateFundEntryPayload {
  entry: FundEntry;
}

export interface DeleteFundEntryPayload {
  entry_id: string;
}

export interface GetDirtyFundDataPayload {}

export interface SyncFundDataPayload {
  funds: Fund[];
  entries: FundEntry[];
}

export interface UpsertGroupPayload {
  group: Group;
  members: GroupMember[];
}

export interface DeleteGroupPayload {
  grp_id: string;
}

export interface FetchGroupsPayload {
  user_id: string;
}

export interface FetchGroupDetailPayload {
  grp_id: string;
  me_id: string;
}

export interface GetDirtyGroupDataPayload {}

export interface SyncGroupDataPayload {
  groups: Group[];
  members: GroupMember[];
}

export interface AddFriendPayload {
  friend: Friend;
}

export interface DeleteFriendPayload {
  friend_id: string;
}

export interface AddAttachmentsPayload {
  owner_type: AttachmentOwnerType;
  owner_id: string;
  attachments: NewAttachment[];
}

export interface ListAttachmentsPayload {
  owner_type: AttachmentOwnerType;
  owner_id: string;
}

export interface GetAttachmentDataPayload {
  attachment_id: string;
}

export interface UpdateAttachmentTypePayload {
  attachment_id: string;
  doc_type: DocType | null;
  source: "AI" | "USER" | null;
}

export interface DeleteAttachmentsPayload {
  attachment_ids: string[];
}

export interface ListAttachmentOwnersPayload {}

export interface ListDocumentedItemsPayload {
  // A DocType, or "UNCLASSIFIED"; omit for all.
  doc_type?: string;
  me_id?: string;
}

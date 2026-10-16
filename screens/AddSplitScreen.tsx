import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Keyboard,
  Animated,
  Dimensions,
  PanResponder,
  Switch,
} from "react-native";

import { useNavigation, useRoute } from "@react-navigation/native";
import { RADIUS, SPACE } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import {
  CustomKeyboard,
  useCustomKeyboard,
} from "../components/CustomKeyboard";
import {
  Amount,
  BottomBar,
  Button,
  EmptyState,
  Field,
  Form,
  FormRef,
  GlyphPlate,
  HeaderTextButton,
  Icon,
  ListRow,
  Pressable,
  RowGroup,
  Sheet,
  SheetRef,
  Text,
  formatMoney,
} from "../components/ui";
import { SplitPayload } from "../types/splits/SplitPayload";
import { useExpensifyStore } from "../store/store";
import { ensureTransactionsLoadedFrom } from "../services/TransactionWindow";
import { getSubcategories } from "../services/selectors";
import { addTransaction, updateTransaction } from "../services/TransactionService";
import CustomSplitEditor from "../components/CustomSplitEditor";
import {
  addSplitData,
  fetchSplitSummary,
  linkTransactionToLedgerEntry,
  updateUserBalances,
} from "../services/Splits";
import CategoryBottomSheet, { CategoryBottomSheetRef } from "../components/CategoryBottomSheet";
import uuid from "react-native-uuid";
import AttachmentStrip, { useAttachmentDraft } from "../components/AttachmentStrip";
import { LedgerEntryRow } from "../types/entity/LedgerEntryRow";
import { LineItemRow } from "../types/entity/LineItemRow";
import { Account } from "../types/entity/Account";
import { formatAmountWithCommas } from "../services/Utils";
import DateTimePicker from "@react-native-community/datetimepicker";
import { ParsedTransaction } from "../types/entity/ParsedImageResult";
import { parsePrefillDate } from "../services/ImageParser";

const rupeesToCents = (rupees: number | string): number => {
  const num = typeof rupees === "string" ? parseFloat(rupees) : rupees;
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
};

const centsToRupees = (cents: number): number => cents / 100;

function getNowTimestamp() {
  return new Date().toISOString();
}

export type SplitType = "ME_PAY_EQUAL" | "OTHER_PAY_EQUAL" | "ME_OWE_ALL" | "OTHER_OWE_ALL";

// Reverse-engineer which preset a stored split matches, so editing restores
// the same chip selection. Falls back to "CUSTOM" for anything bespoke.
function detectSplitType(p: SplitPayload, totalCents: number): string {
  const half = Math.floor(totalCents / 2);
  const rem = totalCents - half * 2;
  const eq = (a: number, b: number) => Math.abs(a - b) <= 1;
  if (eq(p.mePay, totalCents) && eq(p.friendPay, 0)) {
    if (eq(p.meOwe, 0) && eq(p.frinedOwe, totalCents)) return "ME_OWE_ALL";
    if (eq(p.meOwe, half + rem) && eq(p.frinedOwe, half)) return "ME_PAY_EQUAL";
  }
  if (eq(p.friendPay, totalCents) && eq(p.mePay, 0)) {
    if (eq(p.frinedOwe, 0) && eq(p.meOwe, totalCents)) return "OTHER_OWE_ALL";
    if (eq(p.frinedOwe, half + rem) && eq(p.meOwe, half)) return "OTHER_PAY_EQUAL";
  }
  return "CUSTOM";
}

const { width: SCREEN_W } = Dimensions.get('window');

const PLATE = 34;
const ICON_INSET = SPACE.lg + PLATE + SPACE.md;
const colorForId = (id: number, palette: readonly string[]) => palette[Math.abs(id) % palette.length];

const SplitInputScreen: React.FC = () => {
  const { COLORS, isDark } = useTheme();
  const form = useRef<FormRef>(null);
  const route = useRoute<any>();
  const { userId: otherUserId, userName, initialSplitType, prefill, imageParseContext, mode, entryId: editEntryId } = route.params as {
    userId: string;
    userName: string;
    initialSplitType?: string;
    prefill?: ParsedTransaction;
    imageParseContext?: any;
    mode?: "edit";
    entryId?: string;
  };
  const isEditMode = mode === "edit";
  // Split files stay on this device — they're never synced to the friend.
  const attachments = useAttachmentDraft("SPLIT", isEditMode ? editEntryId : null);

  // Bulk mode — pendingQueue shrinks as items are decided
  const initialBulkQueue = useRef(route.params?.bulkQueue as ParsedTransaction[] | undefined).current;
  const isInBulkMode = initialBulkQueue != null;
  // 'edit' → each queue item carries `__entryId`; the carousel hydrates and
  // updates existing splits in place. 'add' (default) → create from parsed images.
  const bulkMode = (route.params?.bulkMode as 'add' | 'edit' | undefined) ?? 'add';
  const isBulkEdit = isInBulkMode && bulkMode === 'edit';
  // Editing an existing split (single or bulk) shares the in-place upsert path.
  const editing = isEditMode || isBulkEdit;
  const [pendingQueue, setPendingQueue] = useState<ParsedTransaction[]>(initialBulkQueue ?? []);
  const [pendingIdx, setPendingIdx] = useState(0);
  const pendingQueueRef = useRef(initialBulkQueue ?? []);
  const pendingIdxRef = useRef(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const navigation: any = useNavigation();

  const categoriesById = useExpensifyStore((state) => state.categories);
  const accountsById = useExpensifyStore((state) => state.accounts);
  const categories = Object.values(categoriesById).filter((c) => !c.is_deleted);
  const accounts = Object.values(accountsById).filter((a) => !a.is_deleted);
  const transactions = useExpensifyStore((state) => state.transactions);
  const me = useExpensifyStore((state) => state.getUserId());
  const userBalancesById = useExpensifyStore((state) => state.userbalances);
  const setUserBalancesInUI = useExpensifyStore((state) => state.setUserBalances);
  const addTransactionToUI = useExpensifyStore((state) => state.addTransaction);
  const updateTransactionInUI = useExpensifyStore((state) => state.updateTransactions);

  // Edit-mode state preserved across the save
  const editCreatedAt = useRef<string | null>(null);
  const editTxnId = useRef<number | null>(null);
  const oldFriendImpact = useRef<number>(0); // friendOwed - friendPaid, for balance delta
  const [editLoading, setEditLoading] = useState(editing);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("0");
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [selectedSplitType, setSelectedSplitType] = useState(initialSplitType ?? "");
  const [addSplitPayload, setAddSplitPayload] = useState<SplitPayload>({
    meOwe: 0, mePay: 0, friendPay: 0, frinedOwe: 0,
  });
  const [addToTransaction, setAddToTransaction] = useState(prefill != null);
  const [selectedBank, setSelectedBank] = useState<Account | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<any>(null);
  const [date, setDate] = useState(parsePrefillDate(prefill?.date));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!prefill) return;
    if (prefill.description) setDescription(prefill.description);
    if (prefill.amount != null) {
      const amtStr = String(prefill.amount);
      setAmount(amtStr);
      if (initialSplitType) {
        const amountCents = rupeesToCents(prefill.amount);
        let payload: SplitPayload;
        switch (initialSplitType as SplitType) {
          case "ME_PAY_EQUAL": {
            const half = Math.floor(amountCents / 2);
            payload = { mePay: amountCents, friendPay: 0, meOwe: half + (amountCents - half * 2), frinedOwe: half };
            break;
          }
          case "OTHER_PAY_EQUAL": {
            const half = Math.floor(amountCents / 2);
            payload = { mePay: 0, friendPay: amountCents, meOwe: half + (amountCents - half * 2), frinedOwe: half };
            break;
          }
          case "ME_OWE_ALL":
            payload = { mePay: amountCents, friendPay: 0, meOwe: 0, frinedOwe: amountCents };
            break;
          case "OTHER_OWE_ALL":
            payload = { mePay: 0, friendPay: amountCents, meOwe: amountCents, frinedOwe: 0 };
            break;
          default:
            payload = { mePay: 0, friendPay: 0, meOwe: 0, frinedOwe: 0 };
        }
        setAddSplitPayload(payload);
      }
    }
    if (prefill.category_id) {
      const cat = categoriesById[prefill.category_id];
      if (cat) setSelectedCategory(cat);
    }
    if (prefill.subcategory_id) {
      const sub = categoriesById[prefill.subcategory_id];
      if (sub) setSelectedSubcategory(sub);
    }
    if (prefill.account_id) {
      const acc = accountsById[prefill.account_id];
      if (acc) setSelectedBank(acc);
    }
    if (prefill.date) {
      setDate(parsePrefillDate(prefill.date));
    }
  }, []);

  const { expression, onKeyPress, evaluateExpression, resetExpression } = useCustomKeyboard("");
  const catSheetRef = useRef<CategoryBottomSheetRef>(null);

  // Hydrate the form from an existing split (single edit or one item of a
  // bulk-edit carousel). Sets the edit refs used by the save path.
  const hydrateFromEntry = useCallback(async (eid: string) => {
    setEditLoading(true);
    try {
      const res = await fetchSplitSummary(eid);
      const items = (res.items ?? []) as {
        user_id: string;
        paid_cents: number;
        owed_cents: number;
      }[];
      const meItem = items.find((i) => i.user_id === me);
      const frItem = items.find((i) => i.user_id === otherUserId);
      const payload: SplitPayload = {
        mePay: meItem?.paid_cents ?? 0,
        meOwe: meItem?.owed_cents ?? 0,
        friendPay: frItem?.paid_cents ?? 0,
        frinedOwe: frItem?.owed_cents ?? 0,
      };
      const totalCents = payload.mePay + payload.friendPay;

      editCreatedAt.current = res.created_at ?? getNowTimestamp();
      editTxnId.current = res.transaction_id ?? null;
      oldFriendImpact.current = payload.frinedOwe - payload.friendPay;

      setDescription(res.description ?? "");
      const amtStr = String(totalCents / 100);
      setAmount(amtStr);
      resetExpression(amtStr);
      setAddSplitPayload(payload);
      setSelectedSplitType(detectSplitType(payload, totalCents));

      if (res.transaction_id) {
        // The linked transaction can be older than the 6-month hot window —
        // pull in older batches, then read fresh from the store.
        if (res.created_at) {
          await ensureTransactionsLoadedFrom(new Date(res.created_at));
        }
        const txn = useExpensifyStore.getState().transactions[String(res.transaction_id)];
        if (txn) {
          setAddToTransaction(true);
          const acc = accountsById[String(txn.account_id)];
          if (acc) setSelectedBank(acc);
          const cat = categoriesById[String(txn.category_id)];
          if (cat) setSelectedCategory(cat);
          if (txn.subcategory_id) {
            const sub = categoriesById[String(txn.subcategory_id)];
            if (sub) setSelectedSubcategory(sub);
          }
          if (txn.date_time) setDate(new Date(txn.date_time));
        }
      } else {
        setAddToTransaction(false);
        setSelectedBank(null);
        setSelectedCategory(null);
        setSelectedSubcategory(null);
      }
    } catch (e) {
      // leave the form empty on failure
    } finally {
      setEditLoading(false);
    }
  }, [me, otherUserId, transactions, accountsById, categoriesById, resetExpression]);

  // Initial hydration: single edit, or the first item of a bulk-edit carousel.
  useEffect(() => {
    if (isEditMode && editEntryId) hydrateFromEntry(editEntryId);
    else if (isBulkEdit && pendingQueueRef.current[0]?.__entryId) {
      hydrateFromEntry(pendingQueueRef.current[0].__entryId as string);
    }
  }, []);

  const resetToItem = useCallback((item: ParsedTransaction | undefined) => {
    if (!item) return;
    // Bulk-edit: re-hydrate the form from the existing split for this item.
    if (isBulkEdit && item.__entryId) {
      hydrateFromEntry(item.__entryId);
      return;
    }
    if (item.description) setDescription(item.description);
    const amtStr = item.amount != null ? String(item.amount) : '0';
    setAmount(amtStr);
    resetExpression(amtStr);
    if (item.category_id) {
      const cat = categoriesById[item.category_id];
      if (cat) setSelectedCategory(cat);
    } else { setSelectedCategory(null); }
    if (item.subcategory_id) {
      const sub = categoriesById[item.subcategory_id];
      if (sub) setSelectedSubcategory(sub);
    } else { setSelectedSubcategory(null); }
    if (item.account_id) {
      const acc = accountsById[item.account_id];
      if (acc) setSelectedBank(acc);
    } else { setSelectedBank(null); }
    if (item.date) setDate(parsePrefillDate(item.date));
    if (initialSplitType && item.amount != null) {
      const amtCents = Math.round(item.amount * 100);
      switch (initialSplitType as SplitType) {
        case 'ME_PAY_EQUAL': { const h = Math.floor(amtCents / 2); setAddSplitPayload({ mePay: amtCents, friendPay: 0, meOwe: h + (amtCents - h * 2), frinedOwe: h }); break; }
        case 'OTHER_PAY_EQUAL': { const h = Math.floor(amtCents / 2); setAddSplitPayload({ mePay: 0, friendPay: amtCents, meOwe: h + (amtCents - h * 2), frinedOwe: h }); break; }
        case 'ME_OWE_ALL': setAddSplitPayload({ mePay: amtCents, friendPay: 0, meOwe: 0, frinedOwe: amtCents }); break;
        case 'OTHER_OWE_ALL': setAddSplitPayload({ mePay: 0, friendPay: amtCents, meOwe: amtCents, frinedOwe: 0 }); break;
      }
    }
    setShowKeyboard(false);
    setShowDatePicker(false);
    catSheetRef.current?.close();
    setError(null);
  }, [categoriesById, accountsById, initialSplitType, resetExpression, isBulkEdit, hydrateFromEntry]);

  const commitAndAdvance = useCallback((action: 'add' | 'skip') => {
    const queue = pendingQueueRef.current;
    const idx = pendingIdxRef.current;
    const newQueue = queue.filter((_, i) => i !== idx);
    const slideOut = action === 'add' ? -SCREEN_W : SCREEN_W;
    Animated.timing(slideAnim, { toValue: slideOut, duration: 200, useNativeDriver: true }).start(() => {
      if (newQueue.length === 0) { navigation.pop(); return; }
      const nextIdx = Math.min(idx, newQueue.length - 1);
      pendingQueueRef.current = newQueue;
      pendingIdxRef.current = nextIdx;
      setPendingQueue(newQueue);
      setPendingIdx(nextIdx);
      resetToItem(newQueue[nextIdx]);
      slideAnim.setValue(-slideOut);
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    });
  }, [slideAnim, resetToItem, navigation]);

  const navigateTo = useCallback((idx: number) => {
    const cur = pendingIdxRef.current;
    if (idx === cur) return;
    const dir = idx > cur ? -SCREEN_W : SCREEN_W;
    Animated.timing(slideAnim, { toValue: dir, duration: 200, useNativeDriver: true }).start(() => {
      pendingIdxRef.current = idx;
      setPendingIdx(idx);
      resetToItem(pendingQueueRef.current[idx]);
      slideAnim.setValue(-dir);
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    });
  }, [slideAnim, resetToItem]);

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) =>
      Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5 && Math.abs(gs.dx) > 15,
    onPanResponderMove: (_, gs) => slideAnim.setValue(gs.dx * 0.7),
    onPanResponderRelease: (_, gs) => {
      const threshold = SCREEN_W * 0.28;
      const cur = pendingIdxRef.current;
      const len = pendingQueueRef.current.length;
      if (gs.dx < -threshold && cur < len - 1) {
        navigateTo(cur + 1);
      } else if (gs.dx > threshold && cur > 0) {
        navigateTo(cur - 1);
      } else {
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 120, friction: 8 }).start();
      }
    },
  })).current;
  const bottomSheetModalRef = useRef<SheetRef>(null);
  const customSheetRef = useRef<SheetRef>(null);
  const accountSheetRef = useRef<SheetRef>(null);

  const suggestions = useMemo(() => {
    const uniq = new Set<string>();
    Object.values(transactions).forEach((t) => {
      const d = t.description?.trim();
      if (d) uniq.add(d);
    });
    return Array.from(uniq);
  }, [transactions]);

  const filteredSuggestions = useMemo(() => {
    if (!description || description.length < 1) return [];
    const lower = description.toLowerCase();
    return suggestions
      .filter((s) => s.toLowerCase().startsWith(lower) && s.toLowerCase() !== lower)
      .slice(0, 4);
  }, [description, suggestions]);

  // After the amount changes, keep the chosen preset split in sync by
  // re-deriving the payload from the new total. CUSTOM splits are left alone.
  const recomputePayloadForAmount = (amtStr: string) => {
    if (selectedSplitType && selectedSplitType !== "CUSTOM") {
      handleSelectSplitType(selectedSplitType as SplitType, amtStr);
    }
  };

  const dismissAll = (except?: "splitSheet" | "customSheet") => {
    if (showKeyboard) {
      const result = evaluateExpression();
      setAmount(result);
      recomputePayloadForAmount(result);
    }
    setShowKeyboard(false);
    setShowDatePicker(false);
    catSheetRef.current?.close();
    if (except !== "splitSheet") bottomSheetModalRef.current?.dismiss();
    if (except !== "customSheet") customSheetRef.current?.dismiss();
    Keyboard.dismiss();
  };

  const handleAmountTap = () => {
    dismissAll();
    // Seed the calculator with the existing amount (e.g. an image-parsed value)
    // so typing continues from it instead of starting over.
    resetExpression(amtFloat > 0 ? amount : "");
    setShowKeyboard(true);
  };

  const handleSelectSplitType = (type: SplitType, amountOverride?: string) => {
    const parsedAmountCents = rupeesToCents(amountOverride ?? amount);
    let splitPayload: SplitPayload;
    switch (type) {
      case "ME_PAY_EQUAL": {
        const half = Math.floor(parsedAmountCents / 2);
        const rem = parsedAmountCents - half * 2;
        splitPayload = { mePay: parsedAmountCents, friendPay: 0, meOwe: half + rem, frinedOwe: half };
        break;
      }
      case "OTHER_PAY_EQUAL": {
        const half = Math.floor(parsedAmountCents / 2);
        const rem = parsedAmountCents - half * 2;
        splitPayload = { mePay: 0, friendPay: parsedAmountCents, meOwe: half + rem, frinedOwe: half };
        break;
      }
      case "ME_OWE_ALL":
        splitPayload = { mePay: parsedAmountCents, friendPay: 0, meOwe: 0, frinedOwe: parsedAmountCents };
        break;
      case "OTHER_OWE_ALL":
        splitPayload = { mePay: 0, friendPay: parsedAmountCents, meOwe: parsedAmountCents, frinedOwe: 0 };
        break;
    }
    setAddSplitPayload(splitPayload);
  };

  const handleSelectCategory = (category: any) => {
    if (category.is_subcategory) {
      setSelectedSubcategory(category);
      catSheetRef.current?.close();
    } else {
      setSelectedCategory(category);
      setSelectedSubcategory(null);
    }
  };

  const handleDateChange = (_: any, selectedDate?: Date) => {
    if (!selectedDate) { setShowDatePicker(false); return; }
    const now = new Date();
    selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    setDate(selectedDate);
    setShowDatePicker(false);
  };

  const formatDate = (d: Date) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };

  const addSplit = async () => {
    try {
      if (editing && editLoading) return; // wait for the form to hydrate
      if (!description.trim() || !selectedSplitType.trim()) {
        setError("Add a description and select how to split");
        return;
      }
      if (addToTransaction && (!selectedBank || !selectedCategory)) {
        setError("Select account and category for the transaction");
        return;
      }
      const amountCents = rupeesToCents(amount);
      if (amountCents <= 0) { setError("Enter an amount"); return; }

      // In edit mode we reuse the original entry id + created_at so the
      // backend upserts in place (and the same row syncs upward). In bulk-edit
      // the target entry is the current carousel item.
      const bulkEntryId = isBulkEdit ? (pendingQueueRef.current[pendingIdxRef.current]?.__entryId as string | undefined) : undefined;
      const entryId = editing ? ((bulkEntryId ?? editEntryId) as string) : (uuid.v4() as string);
      const ledgerEntry: LedgerEntryRow = {
        id: entryId,
        created_at: editing ? (editCreatedAt.current ?? getNowTimestamp()) : getNowTimestamp(),
        updated_at: getNowTimestamp(),
        kind: "SPLIT", is_deleted: false, description, created_by: me, total_cents: amountCents,
      };
      const lineItems: LineItemRow[] = [
        { entry_id: entryId, user_id: me, amount_cents: addSplitPayload.mePay - addSplitPayload.meOwe, paid_cents: addSplitPayload.mePay, owed_cents: addSplitPayload.meOwe, updated_at: getNowTimestamp() },
        { entry_id: entryId, user_id: otherUserId, amount_cents: addSplitPayload.friendPay - addSplitPayload.frinedOwe, paid_cents: addSplitPayload.friendPay, owed_cents: addSplitPayload.frinedOwe, updated_at: getNowTimestamp() },
      ];
      await addSplitData([ledgerEntry], lineItems);

      if (addToTransaction) {
        if (editing && editTxnId.current != null) {
          // Keep the linked transaction in sync with the edited split. The
          // linked transaction can be older than the 6-month hot window.
          if (editCreatedAt.current) {
            await ensureTransactionsLoadedFrom(new Date(editCreatedAt.current));
          }
          const existing = useExpensifyStore.getState().transactions[String(editTxnId.current)];
          const updatedTxn = {
            ...existing,
            id: editTxnId.current,
            description,
            amount: centsToRupees(addSplitPayload.meOwe),
            is_credit: false,
            account_id: selectedBank!.id,
            category_id: selectedCategory.id,
            subcategory_id: selectedSubcategory?.id || null,
            date_time: date.toISOString(),
          };
          const updated = await updateTransaction(updatedTxn);
          updateTransactionInUI(updated);
        } else {
          const txn = {
            id: null, description, amount: centsToRupees(addSplitPayload.meOwe),
            is_credit: false, account_id: selectedBank!.id, category_id: selectedCategory.id,
            subcategory_id: selectedSubcategory?.id || null, date_time: date.toISOString(),
          };
          const added = await addTransaction(txn);
          addTransactionToUI(added);
          await linkTransactionToLedgerEntry(added.id, entryId);
        }
      }

      // After linking, so the transaction side also shows the paperclip.
      if (!isInBulkMode) void attachments.commit(entryId);

      // Balance change for the friend. On edit, apply only the delta versus
      // what this split previously contributed.
      const newFriendImpact = addSplitPayload.frinedOwe - addSplitPayload.friendPay;
      const balanceDelta = editing ? newFriendImpact - oldFriendImpact.current : newFriendImpact;
      let userBalances = { ...userBalancesById };
      userBalances = {
        ...userBalances,
        [otherUserId]: {
          ...userBalances[otherUserId],
          net_cents: userBalances[otherUserId].net_cents + balanceDelta,
        },
      };
      await updateUserBalances(Object.values(userBalances));
      setUserBalancesInUI(Object.values(userBalances));

      if (isInBulkMode) {
        commitAndAdvance('add');
      } else {
        navigation.pop();
      }
    } catch (err) { }
  };

  const handleSkipSplit = useCallback(() => {
    if (isInBulkMode) {
      commitAndAdvance('skip');
    } else {
      navigation.pop();
    }
  }, [isInBulkMode, commitAndAdvance, navigation]);

  const handleAddAllSplits = async () => {
    // Save current first
    await addSplit();
    // Remaining are already handled by commitAndAdvance inside addSplit
    // For "add all", we iterate the rest automatically
    const remaining = pendingQueueRef.current.filter((_, i) => i !== pendingIdxRef.current);
    for (const t of remaining) {
      if (!t.description || !t.amount) continue;
      const amtCents = Math.round(t.amount * 100);
      const half = Math.floor(amtCents / 2);
      let payload = { mePay: amtCents, friendPay: 0, meOwe: half + (amtCents - half * 2), frinedOwe: half };
      if (initialSplitType === 'OTHER_PAY_EQUAL') payload = { mePay: 0, friendPay: amtCents, meOwe: half + (amtCents - half * 2), frinedOwe: half };
      else if (initialSplitType === 'ME_OWE_ALL') payload = { mePay: amtCents, friendPay: 0, meOwe: 0, frinedOwe: amtCents };
      else if (initialSplitType === 'OTHER_OWE_ALL') payload = { mePay: 0, friendPay: amtCents, meOwe: amtCents, frinedOwe: 0 };
      try {
        const entry: LedgerEntryRow = { id: uuid.v4(), created_at: getNowTimestamp(), updated_at: getNowTimestamp(), kind: 'SPLIT', is_deleted: false, description: t.description, created_by: me, total_cents: amtCents };
        const items: LineItemRow[] = [
          { entry_id: entry.id as string, user_id: me, amount_cents: payload.mePay - payload.meOwe, paid_cents: payload.mePay, owed_cents: payload.meOwe, updated_at: getNowTimestamp() },
          { entry_id: entry.id as string, user_id: otherUserId, amount_cents: payload.friendPay - payload.frinedOwe, paid_cents: payload.friendPay, owed_cents: payload.frinedOwe, updated_at: getNowTimestamp() },
        ];
        await addSplitData([entry], items);
      } catch { }
    }
    navigation.pop();
  };

  const amtFloat = parseFloat(amount) || 0;
  const half = amtFloat / 2;
  const splitOptions = [
    { key: "ME_PAY_EQUAL", icon: "account-arrow-right", title: "You paid, split equally", subtitle: `${userName} owes you ₹${formatAmountWithCommas(half, false)}` },
    { key: "ME_OWE_ALL", icon: "account-arrow-right-outline", title: "You paid the full amount", subtitle: `${userName} owes you ₹${formatAmountWithCommas(amtFloat, false)}` },
    { key: "OTHER_PAY_EQUAL", icon: "account-arrow-left", title: `${userName} paid, split equally`, subtitle: `You owe ₹${formatAmountWithCommas(half, false)}` },
    { key: "OTHER_OWE_ALL", icon: "account-arrow-left-outline", title: `${userName} paid fully`, subtitle: `You owe ₹${formatAmountWithCommas(amtFloat, false)}` },
  ];

  const title = isInBulkMode
    ? `${isBulkEdit ? "Edit" : "Split"} ${pendingIdx + 1} of ${pendingQueue.length}`
    : isEditMode ? "Edit split" : "Add split";
  const selectedOption = splitOptions.find((o) => o.key === selectedSplitType);
  const typing = showKeyboard && !!expression;

  const keypad = showKeyboard ? (
    <View style={{ backgroundColor: COLORS.paper }}>
      <CustomKeyboard
        onKeyPress={(key) => {
          if (key === "Done") {
            const result = evaluateExpression();
            setAmount(result);
            // Preserve the chosen split type, re-deriving its payload
            // from the new amount.
            recomputePayloadForAmount(result);
            setShowKeyboard(false);
            return;
          }
          const result: any = onKeyPress(key);
          setAmount(result);
        }}
      />
    </View>
  ) : isInBulkMode ? (
    <BottomBar>
      <Button title={isBulkEdit ? "Save" : "Add"} onPress={addSplit} />
      <Button title="Skip" variant="secondary" onPress={handleSkipSplit} />
    </BottomBar>
  ) : undefined;

  return (
    <Form
      ref={form}
      title={title}
      onSave={addSplit}
      canSave={!(editing && editLoading)}
      dirty={false}
      scroll={false}
      padded={false}
      right={
        isInBulkMode && !isBulkEdit ? (
          <HeaderTextButton label="Add all" emphasis onPress={handleAddAllSplits} />
        ) : undefined
      }
      footer={keypad}
    >
      {/* Bulk progress dots */}
      {isInBulkMode && (
        <View style={styles.dotsRow}>
          {pendingQueue.map((_, i) => (
            <Pressable
              key={i}
              onPress={() => navigateTo(i)}
              haptic="selection"
              accessibilityLabel={`Item ${i + 1}`}
              style={[
                styles.dot,
                { backgroundColor: i === pendingIdx ? COLORS.ink : COLORS.hairline },
                i === pendingIdx && styles.dotCurrent,
              ]}
            />
          ))}
        </View>
      )}

      <Animated.View
        style={[styles.flex, { transform: [{ translateX: slideAnim }] }]}
        {...(isInBulkMode ? panResponder.panHandlers : {})}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, showKeyboard && { paddingBottom: SPACE.lg }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
        >
          {/* Amount hero */}
          <Pressable scale={false} accessibilityLabel="Amount" onPress={handleAmountTap} style={styles.amountHero}>
            <Text variant="callout" tone="muted" align="center" numberOfLines={1}>
              with {userName}
            </Text>
            {typing ? (
              <Text variant="amountLarge" tone="accent" align="center" numberOfLines={1} adjustsFontSizeToFit style={styles.amount}>
                {expression}
              </Text>
            ) : (
              <Amount
                cents={rupeesToCents(amtFloat)}
                variant="display"
                tone={showKeyboard ? "accent" : amtFloat > 0 ? "ink" : "subtle"}
                style={styles.amount}
              />
            )}
            <View style={[styles.caret, { backgroundColor: showKeyboard ? COLORS.accent : "transparent" }]} />
          </Pressable>

          <RowGroup inset={ICON_INSET}>
            <Field
              icon="pencil-outline"
              placeholder="What was it for?"
              value={description}
              onChangeText={setDescription}
              onFocus={() => {
                if (showKeyboard) {
                  const result = evaluateExpression();
                  setAmount(result);
                  recomputePayloadForAmount(result);
                }
                setShowKeyboard(false);
                setShowDatePicker(false);
                catSheetRef.current?.close();
                bottomSheetModalRef.current?.dismiss();
              }}
              returnKeyType="done"
            />
            <ListRow
              icon="call-split"
              iconColor={selectedSplitType ? COLORS.accent : COLORS.inkMuted}
              title={selectedSplitType === "CUSTOM" ? "Custom split" : selectedOption?.title || "How to split?"}
              subtitle={selectedSplitType && selectedSplitType !== "CUSTOM" && amtFloat > 0 ? selectedOption?.subtitle : undefined}
              placeholder={!selectedSplitType}
              chevron
              onPress={() => {
                dismissAll("splitSheet");
                bottomSheetModalRef.current?.present();
              }}
            />
          </RowGroup>

          {/* Suggestions */}
          {filteredSuggestions.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestions}
              keyboardShouldPersistTaps="handled"
            >
              {filteredSuggestions.map((s) => (
                <Pressable key={s} onPress={() => setDescription(s)} haptic="selection">
                  <Text variant="callout" tone="accent" numberOfLines={1}>
                    {s}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Add to transaction */}
          <RowGroup inset={ICON_INSET} style={styles.section}>
            <ListRow
              icon="receipt-text-outline"
              title="Also add as a transaction"
              subtitle={amtFloat > 0 && addSplitPayload.meOwe > 0 ? `Log your share of ${formatMoney(addSplitPayload.meOwe)}` : undefined}
              onPress={() => setAddToTransaction(!addToTransaction)}
              trailing={
                <Switch value={addToTransaction} onValueChange={setAddToTransaction} trackColor={{ true: COLORS.accent }} />
              }
            />
            {addToTransaction && (
              <ListRow
                leading={
                  selectedCategory ? (
                    <GlyphPlate
                      name={(selectedSubcategory ?? selectedCategory).icon_name}
                      type={(selectedSubcategory ?? selectedCategory).icon_type}
                      color={colorForId((selectedSubcategory ?? selectedCategory).id, COLORS.ordinal)}
                      size={PLATE}
                      radius={RADIUS.sm + 2}
                    />
                  ) : undefined
                }
                icon="tag-outline"
                iconColor={COLORS.inkMuted}
                title={
                  selectedCategory
                    ? selectedCategory.name + (selectedSubcategory ? " → " + selectedSubcategory.name : "")
                    : "What kind?"
                }
                placeholder={!selectedCategory}
                chevron
                onPress={() => {
                  dismissAll();
                  setTimeout(() => catSheetRef.current?.open(), 100);
                }}
              />
            )}
            {addToTransaction && (
              <ListRow
                icon="wallet-outline"
                iconColor={selectedBank ? COLORS.accent : COLORS.inkMuted}
                title={selectedBank?.name || "From where?"}
                placeholder={!selectedBank}
                chevron
                onPress={() => {
                  dismissAll();
                  accountSheetRef.current?.present();
                }}
              />
            )}
            {addToTransaction && (
              <ListRow
                icon="calendar-outline"
                title={formatDate(date)}
                chevron
                onPress={() => {
                  dismissAll();
                  setShowDatePicker(!showDatePicker);
                }}
              />
            )}
            {addToTransaction && showDatePicker && (
              <View style={styles.datePicker}>
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="inline"
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                  themeVariant={isDark ? "dark" : "light"}
                  accentColor={COLORS.accent}
                  style={styles.datePickerInner}
                />
              </View>
            )}
          </RowGroup>

          {!isInBulkMode && <AttachmentStrip draft={attachments} onBeforePick={() => dismissAll()} />}

          {error && (
            <Text variant="callout" tone="up" style={styles.error}>
              {error}
            </Text>
          )}
        </ScrollView>
      </Animated.View>

      <CategoryBottomSheet ref={catSheetRef} categories={categories} onSelect={handleSelectCategory} />

      {/* Split type picker */}
      <Sheet ref={bottomSheetModalRef} title="How to split?">
        {splitOptions.map((opt) => {
          const active = selectedSplitType === opt.key;
          return (
            <ListRow
              key={opt.key}
              padded={false}
              icon={opt.icon}
              iconColor={active ? COLORS.accent : COLORS.inkMuted}
              title={opt.title}
              subtitle={amtFloat > 0 ? opt.subtitle : undefined}
              trailing={active ? <Icon name="check" size="md" color={COLORS.accent} /> : undefined}
              onPress={() => {
                handleSelectSplitType(opt.key as SplitType);
                setSelectedSplitType(opt.key);
                bottomSheetModalRef.current?.dismiss();
              }}
            />
          );
        })}
        <Button
          title="Custom split"
          icon="tune-variant"
          variant="secondary"
          onPress={() => {
            bottomSheetModalRef.current?.dismiss();
            setTimeout(() => customSheetRef.current?.present(), 300);
          }}
          style={styles.customBtn}
        />
      </Sheet>

      {/* Custom split editor */}
      <Sheet ref={customSheetRef} snapPoints={["95%"]} scroll={false}>
        <CustomSplitEditor
          total={amtFloat}
          meName="You"
          friendName={userName}
          onDone={(pMe, pFr, oMe, oFr) => {
            setAddSplitPayload({ meOwe: rupeesToCents(oMe), frinedOwe: rupeesToCents(oFr), mePay: rupeesToCents(pMe), friendPay: rupeesToCents(pFr) });
            setSelectedSplitType("CUSTOM");
            customSheetRef.current?.dismiss();
          }}
        />
      </Sheet>

      {/* Account picker */}
      <Sheet ref={accountSheetRef} title="Account">
        {accounts.length === 0 ? (
          <EmptyState icon="wallet-outline" title="No accounts yet" message="Add one from Settings → Accounts." />
        ) : (
          accounts.map((account) => {
            const active = selectedBank?.id === account.id;
            return (
              <ListRow
                key={account.id}
                padded={false}
                icon="wallet-outline"
                iconColor={active ? COLORS.accent : COLORS.inkMuted}
                title={account.name}
                trailing={active ? <Icon name="check" size="md" color={COLORS.accent} /> : undefined}
                onPress={() => {
                  setSelectedBank(account);
                  accountSheetRef.current?.dismiss();
                }}
              />
            );
          })
        )}
      </Sheet>
    </Form>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: SPACE.gutter, paddingBottom: SPACE.xxxl },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: SPACE.xs + 2,
    paddingBottom: SPACE.sm,
  },
  dot: { width: 7, height: 7, borderRadius: RADIUS.pill },
  dotCurrent: { width: 18 },
  amountHero: { alignItems: "center", paddingTop: SPACE.lg, paddingBottom: SPACE.xl },
  amount: { marginTop: SPACE.xs },
  caret: { width: 24, height: 2, borderRadius: RADIUS.pill, marginTop: SPACE.xs },
  suggestions: { gap: SPACE.lg, paddingVertical: SPACE.sm, paddingHorizontal: SPACE.lg },
  section: { marginTop: SPACE.xl },
  datePicker: { alignItems: "center", paddingBottom: SPACE.sm },
  datePickerInner: { height: 320 },
  error: { marginTop: SPACE.md, marginLeft: SPACE.lg },
  customBtn: { marginTop: SPACE.sm, alignSelf: "center" },
});

export default SplitInputScreen;

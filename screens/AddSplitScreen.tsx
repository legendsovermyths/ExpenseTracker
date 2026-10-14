import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Keyboard,
  Animated,
  Dimensions,
  PanResponder,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Provider } from "react-native-paper";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  BottomSheetModal,
  BottomSheetModalProvider,
} from "@gorhom/bottom-sheet";
import { FONTS, SIZES } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";
import { Icon } from "react-native-elements";
import {
  CustomKeyboard,
  useCustomKeyboard,
} from "../components/CustomKeyboard";
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
import CategoryBottomSheet from "../components/CategoryBottomSheet";
import uuid from "react-native-uuid";
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

const SplitInputScreen: React.FC = () => {
  const { COLORS, isDark } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();
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
  const [showAccountPicker, setShowAccountPicker] = useState(false);
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
  const catSheetRef = useRef(null);

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
    setShowAccountPicker(false);
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
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const customSheetRef = useRef<BottomSheetModal>(null);

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
    setShowAccountPicker(false);
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

  return (
    <BottomSheetModalProvider>
      <Provider>
        <View style={styles.container}>
          {/* Bulk progress dots */}
          {isInBulkMode && (
            <View style={[styles.dotsRow, { paddingTop: insets.top + SIZES.base }]}>
              {pendingQueue.map((_, i) => (
                <TouchableOpacity key={i} onPress={() => navigateTo(i)}>
                  <View style={[styles.dot, i === pendingIdx && styles.dotCurrent]} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Header */}
          <View style={[styles.header, isInBulkMode && { paddingTop: SIZES.base }]}>
            <TouchableOpacity onPress={() => navigation.pop()} style={styles.headerBtn}>
              <Icon name="close" type="material-community" size={24} color={COLORS.primary} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>
                {isInBulkMode
                  ? `${isBulkEdit ? 'Edit' : 'Split'} ${pendingIdx + 1} of ${pendingQueue.length}`
                  : isEditMode ? 'Edit Split' : 'Split'}
              </Text>
              <Text style={styles.headerSubtitle}>with {userName}</Text>
            </View>
            {isInBulkMode && !isBulkEdit ? (
              <TouchableOpacity onPress={handleAddAllSplits} style={styles.headerBtn}>
                <Icon name="check-all" type="material-community" size={24} color={COLORS.primary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={addSplit} style={styles.headerBtn}>
                <Icon name="check" type="material-community" size={24} color={COLORS.primary} />
              </TouchableOpacity>
            )}
          </View>

          <Animated.View
            style={[{ flex: 1 }, { transform: [{ translateX: slideAnim }] }]}
            {...(isInBulkMode ? panResponder.panHandlers : {})}
          >

          {/* Amount hero */}
          <TouchableOpacity style={styles.amountSection} activeOpacity={0.8} onPress={handleAmountTap}>
            {!(showKeyboard && expression) && <Text style={styles.currencySymbol}>₹</Text>}
            <Text style={showKeyboard && expression ? styles.amountExpression : styles.amountText}>
              {showKeyboard && expression ? expression : (amtFloat > 0 ? formatAmountWithCommas(amtFloat, false) : "0")}
            </Text>
          </TouchableOpacity>

          {/* Details */}
          <ScrollView style={styles.detailsScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Description */}
            <View style={styles.descriptionRow}>
              <Icon name="pencil-outline" type="material-community" size={20} color={COLORS.darkgray} />
              <TextInput
                style={styles.descriptionInput}
                placeholder="What was it for?"
                placeholderTextColor={COLORS.darkgray}
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
                  setShowAccountPicker(false);
                  catSheetRef.current?.close();
                  bottomSheetModalRef.current?.dismiss();
                }}
                returnKeyType="done"
              />
            </View>

            {/* Suggestions */}
            {filteredSuggestions.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsScroll} contentContainerStyle={styles.suggestionsContent} keyboardShouldPersistTaps="handled">
                {filteredSuggestions.map((s) => (
                  <TouchableOpacity key={s} style={styles.suggestionChip} onPress={() => setDescription(s)}>
                    <Text style={styles.suggestionText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Split type — single tappable row */}
            <View style={styles.detailsCard}>
              <TouchableOpacity
                style={styles.fieldRow}
                onPress={() => {
                  dismissAll("splitSheet");
                  bottomSheetModalRef.current?.present();
                }}
              >
                <Icon name="call-split" type="material-community" size={20} color={selectedSplitType ? COLORS.primary : COLORS.darkgray} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldText, !selectedSplitType && styles.fieldPlaceholder]}>
                    {selectedSplitType === "CUSTOM"
                      ? "Custom split"
                      : splitOptions.find((o) => o.key === selectedSplitType)?.title || "How to split?"}
                  </Text>
                  {selectedSplitType && selectedSplitType !== "CUSTOM" && amtFloat > 0 && (
                    <Text style={styles.splitSubtitle}>
                      {splitOptions.find((o) => o.key === selectedSplitType)?.subtitle}
                    </Text>
                  )}
                </View>
                <Icon name="chevron-right" type="material-community" size={20} color={COLORS.gray} />
              </TouchableOpacity>
            </View>

            {/* Add to transaction toggle */}
            <TouchableOpacity
              style={styles.toggleCard}
              onPress={() => setAddToTransaction(!addToTransaction)}
              activeOpacity={0.7}
            >
              <Icon
                name={addToTransaction ? "checkbox-marked" : "checkbox-blank-outline"}
                type="material-community"
                size={22}
                color={addToTransaction ? COLORS.primary : COLORS.darkgray}
              />
              <Text style={styles.toggleLabel}>Also add as a transaction</Text>
            </TouchableOpacity>

            {/* Transaction details (conditional) */}
            {addToTransaction && (
              <View style={styles.detailsCard}>
                {/* Category */}
                <TouchableOpacity
                  style={styles.fieldRow}
                  onPress={() => { dismissAll(); setTimeout(() => catSheetRef.current?.open(), 100); }}
                >
                  {selectedCategory ? (
                    <Icon name={selectedCategory.icon_name} type={selectedCategory.icon_type} size={20} color={COLORS.primary} />
                  ) : (
                    <Icon name="tag-outline" type="material-community" size={20} color={COLORS.darkgray} />
                  )}
                  <Text style={[styles.fieldText, !selectedCategory && styles.fieldPlaceholder]}>
                    {selectedCategory ? selectedCategory.name + (selectedSubcategory ? " → " + selectedSubcategory.name : "") : "What kind?"}
                  </Text>
                  <Icon name="chevron-right" type="material-community" size={20} color={COLORS.gray} />
                </TouchableOpacity>

                <View style={styles.fieldDivider} />

                {/* Account */}
                <TouchableOpacity
                  style={styles.fieldRow}
                  onPress={() => { dismissAll(); setShowAccountPicker(!showAccountPicker); }}
                >
                  <Icon name="wallet-outline" type="material-community" size={20} color={COLORS.darkgray} />
                  <Text style={[styles.fieldText, !selectedBank && styles.fieldPlaceholder]}>
                    {selectedBank?.name || "From where?"}
                  </Text>
                  <Icon name="chevron-right" type="material-community" size={20} color={COLORS.gray} />
                </TouchableOpacity>

                {showAccountPicker && (
                  <View style={styles.inlinePicker}>
                    {accounts.map((account) => (
                      <TouchableOpacity
                        key={account.id}
                        style={[styles.pickerItem, selectedBank?.id === account.id && styles.pickerItemActive]}
                        onPress={() => { setSelectedBank(account); setShowAccountPicker(false); }}
                      >
                        <Text style={[styles.pickerItemText, selectedBank?.id === account.id && styles.pickerItemTextActive]}>{account.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <View style={styles.fieldDivider} />

                {/* Date */}
                <TouchableOpacity
                  style={styles.fieldRow}
                  onPress={() => { dismissAll(); setShowDatePicker(!showDatePicker); }}
                >
                  <Icon name="calendar-outline" type="material-community" size={20} color={COLORS.darkgray} />
                  <Text style={styles.fieldText}>{formatDate(date)}</Text>
                  <Icon name="chevron-right" type="material-community" size={20} color={COLORS.gray} />
                </TouchableOpacity>

                {showDatePicker && (
                  <View style={{ alignItems: "center", paddingBottom: SIZES.base }}>
                    <DateTimePicker value={date} mode="date" display="inline" onChange={handleDateChange} maximumDate={new Date()} themeVariant={isDark ? "dark" : "light"} style={{ height: 320 }} />
                  </View>
                )}
              </View>
            )}

            {error && <Text style={styles.errorText}>{error}</Text>}

            {/* Bulk mode actions */}
            {isInBulkMode && (
              <View style={styles.bulkActions}>
                <TouchableOpacity style={styles.addBtn} onPress={addSplit}>
                  <Text style={styles.addBtnText}>{isBulkEdit ? 'Save' : 'Add'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.skipBtn} onPress={handleSkipSplit}>
                  <Text style={styles.skipBtnText}>Skip</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={{ height: 120 }} />
          </ScrollView>

          </Animated.View>

          {/* Category Bottom Sheet */}
          <CategoryBottomSheet ref={catSheetRef} categories={categories} onSelect={handleSelectCategory} />

          {/* Split type picker sheet */}
          <BottomSheetModal ref={bottomSheetModalRef} snapPoints={["55%"]} backgroundStyle={{ borderRadius: 24, backgroundColor: COLORS.white }}>
            <View style={{ paddingHorizontal: SIZES.padding }}>
              <Text style={[styles.sectionLabel, { marginTop: SIZES.base }]}>How to split?</Text>
              {splitOptions.map((opt, i) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.sheetOptionRow, i < splitOptions.length - 1 && styles.sheetOptionBorder]}
                  onPress={() => {
                    handleSelectSplitType(opt.key as SplitType);
                    setSelectedSplitType(opt.key);
                    bottomSheetModalRef.current?.dismiss();
                  }}
                >
                  <View style={[styles.sheetOptionIcon, { backgroundColor: selectedSplitType === opt.key ? COLORS.primary + "15" : COLORS.lightGray }]}>
                    <Icon name={opt.icon} type="material-community" size={20} color={selectedSplitType === opt.key ? COLORS.primary : COLORS.darkgray} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetOptionTitle, selectedSplitType === opt.key && { color: COLORS.primary }]}>{opt.title}</Text>
                    {amtFloat > 0 && <Text style={styles.sheetOptionSub}>{opt.subtitle}</Text>}
                  </View>
                  {selectedSplitType === opt.key && (
                    <Icon name="check-circle" type="material-community" size={22} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.sheetCustomBtn}
                onPress={() => {
                  bottomSheetModalRef.current?.dismiss();
                  setTimeout(() => customSheetRef.current?.present(), 300);
                }}
              >
                <Icon name="tune-variant" type="material-community" size={16} color={COLORS.darkgray} />
                <Text style={styles.sheetCustomText}>Custom split</Text>
              </TouchableOpacity>
            </View>
          </BottomSheetModal>

          {/* Custom Split Editor */}
          <BottomSheetModal ref={customSheetRef} snapPoints={["95%"]} backgroundStyle={{ borderRadius: 20, backgroundColor: COLORS.white }}>
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
          </BottomSheetModal>

          {/* Custom Keyboard */}
          {showKeyboard && (
            <View style={styles.keyboardContainer}>
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
          )}
        </View>
      </Provider>
    </BottomSheetModalProvider>
  );
};

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.white },

    // Header
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: SIZES.padding, paddingTop: SIZES.padding * 2.5, paddingBottom: SIZES.base,
    },
    headerBtn: { padding: 4 },
    headerCenter: { alignItems: "center" },
    headerTitle: { ...FONTS.h3, fontWeight: "600", color: COLORS.primary },
    headerSubtitle: { ...FONTS.body4, fontSize: 12, color: COLORS.darkgray, marginTop: 1 },

    // Amount
    amountSection: {
      flexDirection: "row", alignItems: "baseline", justifyContent: "center",
      paddingVertical: SIZES.padding * 0.8,
    },
    currencySymbol: { ...FONTS.h2, fontSize: 22, color: COLORS.darkgray, fontWeight: "400", marginRight: 4 },
    amountText: { fontSize: 40, fontWeight: "800", letterSpacing: -1.5, fontFamily: "Roboto-Bold", color: COLORS.primary },
    amountExpression: { fontSize: 28, fontWeight: "600", letterSpacing: -0.5, fontFamily: "Roboto-Regular", color: COLORS.primary },

    // Details
    detailsScroll: { flex: 1, paddingHorizontal: SIZES.padding },

    descriptionRow: {
      flexDirection: "row", alignItems: "center", gap: SIZES.base + 2,
      marginBottom: SIZES.base + 4, paddingHorizontal: 4,
    },
    descriptionInput: {
      flex: 1, ...FONTS.body2, color: COLORS.primary, fontWeight: "500",
      paddingVertical: SIZES.base,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.gray + "50",
    },

    suggestionsScroll: { marginBottom: SIZES.base + 4, marginTop: -SIZES.base },
    suggestionsContent: { gap: SIZES.base, paddingHorizontal: 4 },
    suggestionChip: { backgroundColor: COLORS.lightGray, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16 },
    suggestionText: { ...FONTS.body4, fontSize: 13, color: COLORS.primary, fontWeight: "500" },

    // Split type
    sectionLabel: { ...FONTS.h3, fontWeight: "700", color: COLORS.primary, letterSpacing: -0.2, marginBottom: SIZES.base + 4 },
    splitSubtitle: { ...FONTS.body4, fontSize: 12, color: COLORS.darkgray, marginTop: 1 },

    // Sheet options
    sheetOptionRow: {
      flexDirection: "row", alignItems: "center", gap: SIZES.base + 2,
      paddingVertical: SIZES.base + 4,
    },
    sheetOptionIcon: {
      width: 36, height: 36, borderRadius: 10,
      justifyContent: "center", alignItems: "center",
    },
    sheetOptionBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.gray + "30" },
    sheetOptionTitle: { ...FONTS.body3, fontWeight: "500", color: COLORS.primary },
    sheetOptionSub: { ...FONTS.body4, fontSize: 12, color: COLORS.darkgray, marginTop: 1 },
    sheetCustomBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 6, paddingVertical: SIZES.padding * 0.7, marginTop: SIZES.base,
    },
    sheetCustomText: { ...FONTS.body4, color: COLORS.darkgray, fontWeight: "500" },

    // Toggle
    toggleCard: {
      flexDirection: "row", alignItems: "center", gap: SIZES.base + 2,
      backgroundColor: COLORS.lightGray, borderRadius: 12,
      paddingHorizontal: SIZES.padding * 0.7, paddingVertical: SIZES.base + 4,
      marginBottom: SIZES.base + 4,
    },
    toggleLabel: { ...FONTS.body3, fontWeight: "500", color: COLORS.primary },

    // Transaction fields (same as TransactionInputScreen)
    detailsCard: { backgroundColor: COLORS.lightGray, borderRadius: 14, overflow: "hidden", marginBottom: SIZES.base + 4 },
    fieldRow: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: SIZES.padding * 0.7, paddingVertical: SIZES.base + 5, gap: SIZES.base + 2,
    },
    fieldText: { ...FONTS.body3, color: COLORS.primary, fontWeight: "500", flex: 1 },
    fieldPlaceholder: { color: COLORS.darkgray, fontWeight: "400" },
    fieldDivider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.gray, marginHorizontal: SIZES.padding * 0.7, opacity: 0.3 },

    inlinePicker: { flexDirection: "row", flexWrap: "wrap", gap: SIZES.base, paddingHorizontal: SIZES.padding * 0.7, paddingBottom: SIZES.base + 4 },
    pickerItem: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.white },
    pickerItemActive: { backgroundColor: COLORS.primary },
    pickerItemText: { ...FONTS.body4, fontWeight: "500", color: COLORS.primary },
    pickerItemTextActive: { color: COLORS.white },

    errorText: { ...FONTS.body4, color: COLORS.red2, marginTop: SIZES.base + 4, marginLeft: 4 },

    keyboardContainer: { backgroundColor: COLORS.white },

    // Bulk mode
    dotsRow: {
      flexDirection: "row", justifyContent: "center", alignItems: "center",
      gap: 6, paddingBottom: 4,
    },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.gray },
    dotCurrent: { backgroundColor: COLORS.primary, width: 18, borderRadius: 4 },
    bulkActions: { marginTop: SIZES.padding, gap: 10 },
    addBtn: { alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primary, borderRadius: SIZES.radius, paddingVertical: 14 },
    addBtnText: { ...FONTS.h4, color: COLORS.white },
    skipBtn: { alignItems: "center", paddingVertical: 12 },
    skipBtnText: { ...FONTS.body3, color: COLORS.darkgray },
  });

export default SplitInputScreen;

import React, { useRef, useMemo, useState, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Keyboard,
  ScrollView,
  Animated,
  Dimensions,
  PanResponder,
  Platform,
} from "react-native";

import { RADIUS, SPACE, TYPE } from "../constants";
import { useRoute } from "@react-navigation/native";
import { useTheme } from "../contexts/ThemeContext";
import {
  addTransaction,
  updateTransaction,
  deleteTransaction,
} from "../services/TransactionService";
import CategoryBottomSheet, { CategoryBottomSheetRef } from "../components/CategoryBottomSheet";
import {
  CustomKeyboard,
  useCustomKeyboard,
} from "../components/CustomKeyboard";
import { getSubcategories } from "../services/selectors";
import { useExpensifyStore } from "../store/store";
import { linkTransactionToLedgerEntry } from "../services/Splits";
import { filterTransactions, getMonthRange, formatCurrency } from "../services/Utils";
import { storeImageParseLog, parsePrefillDate } from "../services/ImageParser";
import { ParsedTransaction } from "../types/entity/ParsedImageResult";
import DateTimePicker from "@react-native-community/datetimepicker";
import AttachmentStrip, { useAttachmentDraft } from "../components/AttachmentStrip";
import {
  Amount,
  BottomBar,
  Button,
  EmptyState,
  Form,
  FormRef,
  GlyphPlate,
  HeaderTextButton,
  Icon,
  ListRow,
  Pressable,
  RowGroup,
  SegmentedControl,
  Sheet,
  SheetRef,
  Text,
  confirm,
  toast,
  ProgressDots,
  haptic,
  hapticRhythm,
} from "../components/ui";
import type { DotState } from "../components/ui";
import { Change, markChanged, markTotalChanged } from "../services/Feedback";

import { getCurrencySymbol } from "../constants/currency";
const { width: SCREEN_W } = Dimensions.get('window');

const PLATE = 34;
const colorForId = (id: number, palette: readonly string[]) => palette[Math.abs(id) % palette.length];

const TransactionInputScreen: React.FC = () => {
  const { COLORS, isDark } = useTheme();
  const route = useRoute<any>();
  const form = useRef<FormRef>(null);
  const catSheetRef = useRef<CategoryBottomSheetRef>(null);
  const accountSheetRef = useRef<SheetRef>(null);
  const dateSheetRef = useRef<SheetRef>(null);
  const descriptionRef = useRef<any>(null);

  const transaction = route.params?.transaction;
  const entryId = route.params?.entryId;
  const mode = route.params?.mode;
  const prefill = route.params?.prefill as ParsedTransaction | undefined;
  const imageParseContext = route.params?.imageParseContext;

  // Bulk (multi-transaction) mode — pendingQueue shrinks as items are decided
  const initialBulkQueue = useRef(route.params?.bulkQueue as ParsedTransaction[] | undefined).current;
  const isInBulkMode = initialBulkQueue != null;
  // 'edit' → each queue item carries a real `id`; saving updates in place.
  // 'add' (default) → saving inserts new transactions (post-image-parse flow).
  const bulkMode = (route.params?.bulkMode as 'add' | 'edit' | undefined) ?? 'add';
  const isBulkEdit = isInBulkMode && bulkMode === 'edit';
  const [pendingQueue, setPendingQueue] = useState<ParsedTransaction[]>(initialBulkQueue ?? []);
  const [pendingIdx, setPendingIdx] = useState(0);
  // Refs so PanResponder (stale closure) can read current values
  const pendingQueueRef = useRef(initialBulkQueue ?? []);
  // Progress across the *original* batch (the queue shrinks as items are decided).
  const originalIndex = useRef(new Map<ParsedTransaction, number>((initialBulkQueue ?? []).map((t, i) => [t, i])));
  const [outcomes, setOutcomes] = useState<DotState[]>(() => (initialBulkQueue ?? []).map(() => "pending"));
  // Bloom marks are applied when the batch closes so they don't expire mid-carousel.
  const savedIdsRef = useRef<{ ids: number[]; spentDelta: number }>({ ids: [], spentDelta: 0 });
  const rememberSaved = (id: number | null | undefined, spentDelta: number) => {
    if (id != null) savedIdsRef.current.ids.push(id);
    savedIdsRef.current.spentDelta += spentDelta;
  };
  const flushSaved = (change: Change) => {
    const { ids, spentDelta } = savedIdsRef.current;
    if (ids.length) markChanged("transaction", ids, change);
    markTotalChanged("spent", Math.round(spentDelta * 100));
    savedIdsRef.current = { ids: [], spentDelta: 0 };
  };
  const pendingIdxRef = useRef(0);

  const slideAnim = useRef(new Animated.Value(0)).current;

  const accountsById = useExpensifyStore((state) => state.accounts);
  const categoriesById = useExpensifyStore((state) => state.categories);
  const addTransactionToUI = useExpensifyStore((state) => state.addTransaction);
  const updateTransactionInUI = useExpensifyStore((state) => state.updateTransactions);
  const deleteTransactionFromUI = useExpensifyStore((state) => state.deleteTransaction);

  const allAccounts = Object.values(accountsById);
  const allCategories = Object.values(categoriesById);
  const categories = allCategories.filter((c) => !c.is_deleted);
  const accounts = allAccounts.filter((a) => !a.is_deleted);

  const { expression, onKeyPress, evaluateExpression, resetExpression } = useCustomKeyboard(
    transaction?.amount?.toString() || prefill?.amount?.toString() || "",
  );

  const [description, setDescription] = useState(transaction?.description || prefill?.description || "");
  const [amount, setAmount] = useState(transaction?.amount?.toString() || prefill?.amount?.toString() || "0");
  // Amount-first: a fresh transaction opens with the keypad up.
  const [showKeyboard, setShowKeyboard] = useState(
    mode !== "edit" && !isInBulkMode && !prefill && !transaction?.amount,
  );
  const [selectedCredit, setSelectedCredit] = useState(
    transaction?.credit ?? (prefill?.is_credit ? 1 : 0),
  );
  const [selectedBank, setSelectedBank] = useState(
    useExpensifyStore((state) =>
      state.getAccountById(transaction?.account_id ?? prefill?.account_id),
    ) || null,
  );
  const [selectedCategory, setSelectedCategory] = useState(
    useExpensifyStore((state) =>
      state.getCategoryById(transaction?.category_id ?? prefill?.category_id),
    ) || null,
  );
  const [selectedSubcategory, setSelectedSubcategory] = useState(
    useExpensifyStore((state) =>
      state.getCategoryById(transaction?.subcategory_id ?? prefill?.subcategory_id),
    ) || null,
  );
  const [, setSubcategories] = useState(
    transaction
      ? getSubcategories(categories, transaction.category_id)
      : prefill?.category_id
        ? getSubcategories(categories, prefill.category_id)
        : [],
  );
  const [date, setDate] = useState(
    transaction ? new Date(transaction.date_time) : parsePrefillDate(prefill?.date),
  );
  const [showAndroidDatePicker, setShowAndroidDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  // Bulk flows skip attachments to keep the review queue fast.
  const attachments = useAttachmentDraft("TRANSACTION", mode === "edit" ? transaction?.id : null);

  // ── dirty tracking ─────────────────────────────────────────────────
  const initial = useRef({
    amount,
    description,
    credit: selectedCredit,
    bankId: selectedBank?.id ?? null,
    categoryId: selectedCategory?.id ?? null,
    subcategoryId: selectedSubcategory?.id ?? null,
    date: date.getTime(),
  }).current;
  const loadedFiles = useRef(0);
  useEffect(() => {
    loadedFiles.current = Math.max(loadedFiles.current, attachments.existing.length + attachments.staged.length * 0);
  }, [attachments.existing.length, attachments.staged.length]);
  const attachmentsDirty =
    attachments.staged.length > 0 || attachments.existing.length < loadedFiles.current;
  const dirty =
    isInBulkMode ||
    (showKeyboard ? expression : amount) !== (showKeyboard && initial.amount === "0" ? "" : initial.amount) ||
    description !== initial.description ||
    selectedCredit !== initial.credit ||
    (selectedBank?.id ?? null) !== initial.bankId ||
    (selectedCategory?.id ?? null) !== initial.categoryId ||
    (selectedSubcategory?.id ?? null) !== initial.subcategoryId ||
    date.getTime() !== initial.date ||
    attachmentsDirty;

  const transactions = useExpensifyStore((s) => s.transactions);
  const categoryBudgets = useExpensifyStore((s) => s.categoryBudgets);
  const suggestions = useMemo(() => {
    const uniq = new Set<string>();
    Object.values(transactions).forEach((t) => {
      const d = t.description?.trim();
      if (d) uniq.add(d);
    });
    return Array.from(uniq);
  }, [transactions]);

  const closePickers = () => {
    setShowAndroidDatePicker(false);
    accountSheetRef.current?.dismiss();
    dateSheetRef.current?.dismiss();
    catSheetRef.current?.close();
  };

  const dismissAll = () => {
    if (showKeyboard) {
      const result = evaluateExpression();
      setAmount(result);
    }
    setShowKeyboard(false);
    closePickers();
    Keyboard.dismiss();
  };

  const handleAmountTap = () => {
    dismissAll();
    setShowKeyboard(true);
  };

  const openAccountPicker = () => accountSheetRef.current?.present();

  const advanceToNextEmpty = () => {
    if (!description.trim()) {
      descriptionRef.current?.focus();
      return;
    }
    if (!selectedCategory) {
      setTimeout(() => catSheetRef.current?.open(), 100);
      return;
    }
    if (!selectedBank) {
      openAccountPicker();
      return;
    }
    // All filled — do nothing, user can tap Save
  };

  const makeTransactionObject = () => {
    const newAmount = evaluateExpression();
    const bulkEditId = isBulkEdit ? pendingQueueRef.current[pendingIdxRef.current]?.id ?? null : null;
    return {
      id: transaction?.id ?? bulkEditId ?? null,
      description,
      amount: Number(newAmount),
      is_credit: Boolean(selectedCredit),
      account_id: selectedBank?.id,
      category_id: selectedCategory?.id,
      subcategory_id: selectedSubcategory ? selectedSubcategory.id : null,
      date_time: date.toISOString(),
    };
  };

  const validate = () => {
    if (amount === "Error") {
      toast("That amount doesn't add up", "error");
      return false;
    }
    const missing = [
      !amount.trim() && "an amount",
      !description.trim() && "a description",
      !selectedCategory && "a category",
      !selectedBank && "an account",
    ].filter(Boolean) as string[];
    if (missing.length > 0) {
      const list = missing.length > 1 ? `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}` : missing[0];
      toast(`Add ${list}`, "error");
      return false;
    }
    return true;
  };

  const resetToItem = useCallback((item: ParsedTransaction | undefined) => {
    const newAmt = item?.amount?.toString() || '0';
    setDescription(item?.description || '');
    setAmount(newAmt);
    resetExpression(newAmt);
    setSelectedCredit(item?.is_credit ? 1 : 0);
    const bank = item?.account_id ? (accountsById[item.account_id] ?? null) : null;
    setSelectedBank(bank);
    const cat = item?.category_id ? (categoriesById[item.category_id] ?? null) : null;
    setSelectedCategory(cat);
    const sub = item?.subcategory_id ? (categoriesById[item.subcategory_id] ?? null) : null;
    setSelectedSubcategory(sub);
    setSubcategories(cat ? getSubcategories(categories, cat.id) : []);
    setDate(parsePrefillDate(item?.date));
    setShowKeyboard(false);
    setShowAndroidDatePicker(false);
    accountSheetRef.current?.dismiss();
    dateSheetRef.current?.dismiss();
    catSheetRef.current?.close();
  }, [accountsById, categoriesById, categories, resetExpression]);

  // Commit (add or skip) the item at current pendingIdx, slide it away, show next
  const commitAndAdvance = useCallback((action: 'add' | 'skip') => {
    const queue = pendingQueueRef.current;
    const idx = pendingIdxRef.current;
    const newQueue = queue.filter((_, i) => i !== idx);
    const slideOut = action === 'add' ? -SCREEN_W : SCREEN_W;
    // Dot feedback plays alongside the slide — nothing waits on it.
    const orig = originalIndex.current.get(queue[idx]);
    if (orig !== undefined) {
      setOutcomes((o) => o.map((s, i) => (i === orig ? (action === 'add' ? "added" : "skipped") : s)));
    }
    if (newQueue.length === 0) {
      hapticRhythm("batchDone");
      flushSaved(isBulkEdit ? "edited" : "added");
    } else if (action === 'add') {
      haptic("selection");
    }
    Animated.timing(slideAnim, { toValue: slideOut, duration: 200, useNativeDriver: true }).start(() => {
      if (newQueue.length === 0) { form.current?.close(); return; }
      const nextIdx = Math.min(idx, newQueue.length - 1);
      pendingQueueRef.current = newQueue;
      pendingIdxRef.current = nextIdx;
      setPendingQueue(newQueue);
      setPendingIdx(nextIdx);
      resetToItem(newQueue[nextIdx]);
      slideAnim.setValue(-slideOut);
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    });
  }, [slideAnim, resetToItem]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate without committing (swipe / dot tap)
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

  // Per-item parse origin: each queue item carries its own image + LLM output
  // (multi-image batch); fall back to the shared context for the legacy path.
  const logSource = (item?: ParsedTransaction) => {
    if (item?.__llmOutput) {
      // Prefer the stable content hash; fall back to the (ephemeral) uri.
      return { imageHash: item.__imageHash ?? item.__imageUri ?? '', llmOutput: item.__llmOutput };
    }
    if (imageParseContext) {
      return { imageHash: imageParseContext.imageUri, llmOutput: imageParseContext.llmOutput };
    }
    return undefined;
  };

  const handleSave = async () => {
    if (saving || !validate()) return;
    setSaving(true);
    try {
      const txn = makeTransactionObject();
      const spentBefore = (mode === "edit" || isBulkEdit) && transaction && !transaction.is_credit ? transaction.amount ?? 0 : 0;
      const spentDelta = (txn.is_credit ? 0 : txn.amount) - (isBulkEdit ? 0 : spentBefore);
      if (mode === "edit" || isBulkEdit) {
        const updated = await updateTransaction(txn);
        updateTransactionInUI(updated);
        if (!isInBulkMode) void attachments.commit(updated.id ?? txn.id);
        rememberSaved(updated.id ?? txn.id, isBulkEdit ? 0 : spentDelta);
      } else {
        const added = await addTransaction(txn);
        // Link to a ledger entry: screen-level (single split) or per-item (split → txn batch).
        const itemEntryId = isInBulkMode ? pendingQueueRef.current[pendingIdxRef.current]?.__entryId : undefined;
        const linkId = entryId ?? itemEntryId;
        if (linkId) await linkTransactionToLedgerEntry(added.id, linkId);
        if (!isInBulkMode) void attachments.commit(added.id);
        addTransactionToUI(added);
        rememberSaved(added.id, spentDelta);
        const src = logSource(isInBulkMode ? pendingQueueRef.current[pendingIdxRef.current] : prefill);
        if (src) {
          storeImageParseLog(src.imageHash, src.llmOutput, added.id);
        }
      }
    } catch {
      setSaving(false);
      toast("Couldn't save the transaction", "error");
      return;
    }
    if (isInBulkMode) {
      setSaving(false);
      commitAndAdvance('add');
    } else {
      hapticRhythm("saveLanded");
      flushSaved(mode === "edit" ? "edited" : "added");
      form.current?.close();
    }
  };

  const handleSkip = useCallback(() => {
    if (isInBulkMode) {
      commitAndAdvance('skip');
    } else {
      form.current?.close();
    }
  }, [isInBulkMode, commitAndAdvance]);

  const handleAddAll = async () => {
    // Save current transaction first
    if (saving || !validate()) return;
    setSaving(true);
    try {
      const txn = makeTransactionObject();
      if (isBulkEdit) {
        const updated = await updateTransaction(txn);
        updateTransactionInUI(updated);
        rememberSaved(updated.id ?? txn.id, 0);
      } else {
        const added = await addTransaction(txn);
        rememberSaved(added.id, txn.is_credit ? 0 : txn.amount);
        const curEntryId = pendingQueueRef.current[pendingIdxRef.current]?.__entryId;
        if (curEntryId) await linkTransactionToLedgerEntry(added.id, curEntryId);
        addTransactionToUI(added);
        const curSrc = logSource(pendingQueueRef.current[pendingIdxRef.current]);
        if (curSrc) {
          storeImageParseLog(curSrc.imageHash, curSrc.llmOutput, added.id);
        }
      }
    } catch {
      setSaving(false);
      toast("Couldn't save the transaction", "error");
      return;
    }

    // Save all remaining from queue without review
    const remaining = pendingQueueRef.current.filter((_, i) => i !== pendingIdxRef.current);
    for (const t of remaining) {
      if (!t.description || !t.amount || !t.category_id || !t.account_id) continue;
      const cat = categoriesById[t.category_id];
      const acc = accountsById[t.account_id];
      if (!cat || !acc) continue;
      try {
        if (isBulkEdit) {
          const updated = await updateTransaction({
            id: t.id ?? null,
            description: t.description,
            amount: t.amount,
            is_credit: t.is_credit ?? false,
            account_id: acc.id,
            category_id: cat.id,
            subcategory_id: t.subcategory_id ? (categoriesById[t.subcategory_id]?.id ?? null) : null,
            date_time: parsePrefillDate(t.date).toISOString(),
          });
          updateTransactionInUI(updated);
          rememberSaved(updated.id, 0);
          continue;
        }
        const savedTxn = await addTransaction({
          id: null,
          description: t.description,
          amount: t.amount,
          is_credit: t.is_credit ?? false,
          account_id: acc.id,
          category_id: cat.id,
          subcategory_id: t.subcategory_id ? (categoriesById[t.subcategory_id]?.id ?? null) : null,
          date_time: parsePrefillDate(t.date).toISOString(),
        });
        addTransactionToUI(savedTxn);
        rememberSaved(savedTxn.id, t.is_credit ? 0 : t.amount);
        if (t.__entryId) await linkTransactionToLedgerEntry(savedTxn.id, t.__entryId);
        const tSrc = logSource(t);
        if (tSrc) {
          storeImageParseLog(tSrc.imageHash, tSrc.llmOutput, savedTxn.id);
        }
      } catch { /* skip failed */ }
    }
    setOutcomes((o) => o.map(() => "added"));
    hapticRhythm("batchDone");
    flushSaved(isBulkEdit ? "edited" : "added");
    form.current?.close();
  };

  const handleDelete = async () => {
    const ok = await confirm({ title: "Delete this transaction?", message: "This can't be undone." });
    if (!ok) return;
    try {
      await deleteTransaction(transaction);
    } catch {
      toast("Couldn't delete the transaction", "error");
      return;
    }
    if (!transaction.is_credit) markTotalChanged("spent", -Math.round((transaction.amount ?? 0) * 100));
    deleteTransactionFromUI(transaction.id);
    haptic("light");
    form.current?.close();
  };

  const handleSelectCategory = (category: any) => {
    if (category.is_subcategory) {
      setSelectedSubcategory(category);
      catSheetRef.current?.close();
      // Advance to account if empty
      if (!selectedBank) {
        setTimeout(openAccountPicker, 350);
      }
    } else {
      setSelectedCategory(category);
      const subs = getSubcategories(categories, category.id);
      setSubcategories(subs);
      setSelectedSubcategory(null);
      // If no subcategories, the sheet will close — advance to account if empty
      if (subs.length === 0 && !selectedBank) {
        setTimeout(openAccountPicker, 350);
      }
    }
  };

  const handleDateChange = (_: any, selectedDate?: Date) => {
    setShowAndroidDatePicker(false);
    dateSheetRef.current?.dismiss();
    if (!selectedDate) return;
    const now = new Date();
    selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    setDate(selectedDate);
  };

  const openDatePicker = () => {
    dismissAll();
    if (Platform.OS === "ios") dateSheetRef.current?.present();
    else setShowAndroidDatePicker(true);
  };

  const formatDate = (d: Date) => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      ...(d.getFullYear() !== today.getFullYear() && { year: "numeric" }),
    });
  };

  const amountNum = parseFloat(amount) || 0;

  // Budget hint for selected category
  const budgetHint = useMemo(() => {
    if (!selectedCategory || selectedCredit) return null;
    const budget = categoryBudgets[selectedCategory.id];
    if (!budget || budget.amount <= 0) return null;

    const now = new Date();
    const { firstDate, lastDate } = getMonthRange(now.getFullYear(), now.getMonth());
    const monthTxns = filterTransactions(Object.values(transactions), {
      startDate: firstDate.toISOString(),
      endDate: lastDate.toISOString(),
    });
    const spent = monthTxns
      .filter((t) => !t.is_credit && t.category_id === selectedCategory.id)
      .reduce((a, t) => a + t.amount, 0);
    const remaining = budget.amount - spent;
    return { remaining, budget: budget.amount, spent };
  }, [selectedCategory, selectedCredit, categoryBudgets, transactions]);

  const filteredSuggestions = useMemo(() => {
    if (!description || description.length < 1) return [];
    const lower = description.toLowerCase();
    return suggestions
      .filter((s) => s.toLowerCase().startsWith(lower) && s.toLowerCase() !== lower)
      .slice(0, 4);
  }, [description, suggestions]);

  // ── render ─────────────────────────────────────────────────────────
  const title =
    mode === "edit"
      ? "Edit transaction"
      : isInBulkMode
        ? `${isBulkEdit ? "Edit" : "Expense"} ${pendingIdx + 1} of ${pendingQueue.length}`
        : "New transaction";

  const typing = showKeyboard && !!expression;
  const hasOperator = /[+\-*/()]/.test(expression.replace(/^-/, ""));
  const amountTone = selectedCredit ? "down" : "ink";

  const categoryColor = selectedCategory ? colorForId(selectedCategory.id, COLORS.ordinal) : COLORS.accent;
  const categoryLabel = selectedCategory
    ? selectedCategory.name + (selectedSubcategory ? `  ·  ${selectedSubcategory.name}` : "")
    : "Category";

  const onKeypad = (key: string) => {
    if (key === "Done") {
      const result = evaluateExpression();
      setAmount(result);
      setShowKeyboard(false);
      advanceToNextEmpty();
      return;
    }
    const result = onKeyPress(key);
    setAmount(String(result));
  };

  const footer = showKeyboard ? (
    <CustomKeyboard onKeyPress={onKeypad} />
  ) : isInBulkMode ? (
    <BottomBar>
      <Button title={isBulkEdit ? "Save" : "Add"} onPress={handleSave} loading={saving} />
      <Button title="Skip" variant="secondary" onPress={handleSkip} />
    </BottomBar>
  ) : undefined;

  return (
    <Form
      ref={form}
      title={title}
      onSave={handleSave}
      saving={saving}
      dirty={dirty}
      scroll={false}
      padded={false}
      right={
        isInBulkMode ? (
          <HeaderTextButton label={isBulkEdit ? "Save all" : "Add all"} emphasis onPress={handleAddAll} loading={saving} />
        ) : undefined
      }
      footer={footer}
    >
      {isInBulkMode && outcomes.length > 1 && (
        <ProgressDots
          states={outcomes}
          index={originalIndex.current.get(pendingQueue[pendingIdx]) ?? 0}
          done={outcomes.every((o) => o !== "pending")}
          onPress={(orig) => {
            const qi = pendingQueue.findIndex((t) => originalIndex.current.get(t) === orig);
            if (qi >= 0) navigateTo(qi);
          }}
          style={styles.dots}
        />
      )}

      <Animated.View
        style={[styles.flex, { transform: [{ translateX: slideAnim }] }]}
        {...(isInBulkMode ? panResponder.panHandlers : {})}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
        >
          <SegmentedControl
            value={selectedCredit ? "income" : "expense"}
            onChange={(k) => {
              setSelectedCredit(k === "income" ? 1 : 0);
              if (!showKeyboard) closePickers();
            }}
            options={[
              { key: "expense", label: "Expense" },
              { key: "income", label: "Income" },
            ]}
          />

          {/* Amount hero */}
          <Pressable
            onPress={handleAmountTap}
            scale={false}
            accessibilityLabel="Amount"
            style={styles.amount}
          >
            {typing ? (
              <Text
                variant={hasOperator ? "amountLarge" : "display"}
                tone={amountTone}
                align="center"
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {hasOperator ? expression : `${getCurrencySymbol()}${expression}`}
              </Text>
            ) : (
              <Amount
                cents={Math.round(amountNum * 100)}
                variant="display"
                tone={amountNum > 0 ? amountTone : "subtle"}
                decimals="auto"
              />
            )}
            <View
              style={[
                styles.caret,
                { backgroundColor: showKeyboard ? COLORS.accent : "transparent" },
              ]}
            />
          </Pressable>

          {/* Description */}
          <TextInput
            ref={descriptionRef}
            style={[TYPE.title, styles.description, { color: COLORS.ink }]}
            placeholder="What was it for?"
            placeholderTextColor={COLORS.inkSubtle}
            selectionColor={COLORS.accent}
            value={description}
            onChangeText={setDescription}
            onFocus={() => {
              if (showKeyboard) {
                const result = evaluateExpression();
                setAmount(result);
              }
              setShowKeyboard(false);
              closePickers();
            }}
            returnKeyType="done"
            onSubmitEditing={() => {
              if (!selectedCategory) {
                setTimeout(() => catSheetRef.current?.open(), 100);
              } else if (!selectedBank) {
                openAccountPicker();
              }
            }}
          />

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

          <RowGroup inset={SPACE.lg + PLATE + SPACE.md} style={styles.group}>
            <ListRow
              leading={
                <GlyphPlate
                  name={selectedCategory?.icon_name ?? "tag-outline"}
                  type={selectedCategory?.icon_type ?? "material-community"}
                  color={selectedCategory ? categoryColor : COLORS.inkMuted}
                  size={PLATE}
                  radius={10}
                />
              }
              title={categoryLabel}
              placeholder={!selectedCategory}
              chevron
              onPress={() => {
                dismissAll();
                setTimeout(() => catSheetRef.current?.open(), 100);
              }}
            />
            <ListRow
              icon="wallet-outline"
              iconColor={selectedBank ? COLORS.accent : COLORS.inkMuted}
              title={selectedBank?.name || "Account"}
              placeholder={!selectedBank}
              chevron
              onPress={() => {
                dismissAll();
                openAccountPicker();
              }}
            />
            <ListRow
              icon="calendar-blank-outline"
              title={formatDate(date)}
              chevron
              onPress={openDatePicker}
            />
          </RowGroup>

          {budgetHint && (
            <Text
              variant="caption"
              tone={budgetHint.remaining >= 0 ? "muted" : "up"}
              style={styles.hint}
            >
              {budgetHint.remaining >= 0
                ? `${formatCurrency(budgetHint.remaining, false)} left of your ${selectedCategory?.name} budget this month`
                : `${formatCurrency(Math.abs(budgetHint.remaining), false)} over your ${selectedCategory?.name} budget this month`}
            </Text>
          )}

          {!isInBulkMode && <AttachmentStrip draft={attachments} onBeforePick={dismissAll} />}

          {mode === "edit" && (
            <Button
              title="Delete transaction"
              variant="destructive"
              onPress={handleDelete}
              style={styles.delete}
            />
          )}
        </ScrollView>
      </Animated.View>

      {showAndroidDatePicker && (
        <DateTimePicker value={date} mode="date" onChange={handleDateChange} maximumDate={new Date()} />
      )}

      <CategoryBottomSheet ref={catSheetRef} categories={categories} onSelect={handleSelectCategory} />

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

      {Platform.OS === "ios" && (
        <Sheet ref={dateSheetRef} title="Date">
          <DateTimePicker
            value={date}
            mode="date"
            display="inline"
            onChange={handleDateChange}
            maximumDate={new Date()}
            themeVariant={isDark ? "dark" : "light"}
            accentColor={COLORS.accent}
            style={styles.datePicker}
          />
        </Sheet>
      )}
    </Form>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: SPACE.gutter, paddingTop: SPACE.sm, paddingBottom: SPACE.xxl },
  dots: { marginBottom: SPACE.xs },
  amount: { alignItems: "center", paddingTop: SPACE.xl, paddingBottom: SPACE.md },
  caret: { width: 24, height: 2, borderRadius: RADIUS.pill, marginTop: SPACE.xs },
  description: { textAlign: "center", paddingVertical: SPACE.sm, margin: 0 },
  suggestions: { gap: SPACE.lg, paddingVertical: SPACE.xs, flexGrow: 1, justifyContent: "center" },
  group: { marginTop: SPACE.lg },
  hint: { marginTop: SPACE.sm, marginLeft: SPACE.lg },
  delete: { marginTop: SPACE.xl, alignSelf: "center" },
  datePicker: { alignSelf: "center" },
});

export default TransactionInputScreen;

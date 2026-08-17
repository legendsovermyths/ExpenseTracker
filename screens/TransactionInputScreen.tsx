import React, { useRef, useMemo, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  Keyboard,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  Dimensions,
  PanResponder,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Provider } from "react-native-paper";
import { FONTS, SIZES } from "../constants";
import { useNavigation, useRoute } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "./AppNavigator";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";
import { Icon } from "react-native-elements";
import {
  addTransaction,
  updateTransaction,
  deleteTransaction,
} from "../services/TransactionService";
import CategoryBottomSheet from "../components/CategoryBottomSheet";
import {
  CustomKeyboard,
  useCustomKeyboard,
} from "../components/CustomKeyboard";
import { getSubcategories } from "../services/selectors";
import { useExpensifyStore } from "../store/store";
import { linkTransactionToLedgerEntry } from "../services/Splits";
import { formatAmountWithCommas, filterTransactions, getMonthRange } from "../services/Utils";
import { storeImageParseLog, parsePrefillDate } from "../services/ImageParser";
import { ParsedTransaction } from "../types/entity/ParsedImageResult";
import DateTimePicker from "@react-native-community/datetimepicker";

const { width: SCREEN_W } = Dimensions.get('window');

const TransactionInputScreen: React.FC = () => {
  const { COLORS, isDark } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const catSheetRef = useRef(null);
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

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { expression, onKeyPress, evaluateExpression, resetExpression } = useCustomKeyboard(
    transaction?.amount?.toString() || prefill?.amount?.toString() || "",
  );

  const [description, setDescription] = useState(transaction?.description || prefill?.description || "");
  const [amount, setAmount] = useState(transaction?.amount?.toString() || prefill?.amount?.toString() || "0");
  const [showKeyboard, setShowKeyboard] = useState(false);
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
  const [subcategories, setSubcategories] = useState(
    transaction
      ? getSubcategories(categories, transaction.category_id)
      : prefill?.category_id
        ? getSubcategories(categories, prefill.category_id)
        : [],
  );
  const [date, setDate] = useState(
    transaction ? new Date(transaction.date_time) : parsePrefillDate(prefill?.date),
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const dismissAll = () => {
    if (showKeyboard) {
      const result = evaluateExpression();
      setAmount(result);
    }
    setShowKeyboard(false);
    setShowDatePicker(false);
    setShowAccountPicker(false);
    catSheetRef.current?.close();
    Keyboard.dismiss();
  };

  const handleAmountTap = () => {
    dismissAll();
    setShowKeyboard(true);
  };

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
      setShowAccountPicker(true);
      return;
    }
    // All filled — do nothing, user can tap ✓
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
    if (!amount.trim() || !description.trim() || !selectedBank || !selectedCategory || amount === "Error") {
      setError("Please fill all the required fields");
      return false;
    }
    setError(null);
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
    setShowDatePicker(false);
    setShowAccountPicker(false);
    catSheetRef.current?.close();
    setError(null);
  }, [accountsById, categoriesById, categories, resetExpression]);

  // Commit (add or skip) the item at current pendingIdx, slide it away, show next
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
    if (!validate()) return;
    const txn = makeTransactionObject();
    if (mode === "edit" || isBulkEdit) {
      const updated = await updateTransaction(txn);
      updateTransactionInUI(updated);
    } else {
      const added = await addTransaction(txn);
      // Link to a ledger entry: screen-level (single split) or per-item (split → txn batch).
      const itemEntryId = isInBulkMode ? pendingQueueRef.current[pendingIdxRef.current]?.__entryId : undefined;
      const linkId = entryId ?? itemEntryId;
      if (linkId) await linkTransactionToLedgerEntry(added.id, linkId);
      addTransactionToUI(added);
      const src = logSource(isInBulkMode ? pendingQueueRef.current[pendingIdxRef.current] : prefill);
      if (src) {
        storeImageParseLog(src.imageHash, src.llmOutput, added.id);
      }
    }
    if (isInBulkMode) {
      commitAndAdvance('add');
    } else {
      navigation.pop();
    }
  };

  const handleSkip = useCallback(() => {
    if (isInBulkMode) {
      commitAndAdvance('skip');
    } else {
      navigation.pop();
    }
  }, [isInBulkMode, commitAndAdvance]);

  const handleAddAll = async () => {
    // Save current transaction first
    if (!validate()) return;
    const txn = makeTransactionObject();
    if (isBulkEdit) {
      const updated = await updateTransaction(txn);
      updateTransactionInUI(updated);
    } else {
      const added = await addTransaction(txn);
      const curEntryId = pendingQueueRef.current[pendingIdxRef.current]?.__entryId;
      if (curEntryId) await linkTransactionToLedgerEntry(added.id, curEntryId);
      addTransactionToUI(added);
      const curSrc = logSource(pendingQueueRef.current[pendingIdxRef.current]);
      if (curSrc) {
        storeImageParseLog(curSrc.imageHash, curSrc.llmOutput, added.id);
      }
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
        if (t.__entryId) await linkTransactionToLedgerEntry(savedTxn.id, t.__entryId);
        const tSrc = logSource(t);
        if (tSrc) {
          storeImageParseLog(tSrc.imageHash, tSrc.llmOutput, savedTxn.id);
        }
      } catch { /* skip failed */ }
    }
    navigation.pop();
  };

  const handleDelete = () => {
    Alert.alert("Delete Transaction", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteTransaction(transaction);
          deleteTransactionFromUI(transaction.id);
          navigation.pop();
        },
      },
    ]);
  };

  const handleSelectCategory = (category: any) => {
    if (category.is_subcategory) {
      setSelectedSubcategory(category);
      catSheetRef.current?.close();
      // Advance to account if empty
      if (!selectedBank) {
        setTimeout(() => setShowAccountPicker(true), 300);
      }
    } else {
      setSelectedCategory(category);
      const subs = getSubcategories(categories, category.id);
      setSubcategories(subs);
      setSelectedSubcategory(null);
      // If no subcategories, the sheet will close — advance to account if empty
      if (subs.length === 0 && !selectedBank) {
        setTimeout(() => setShowAccountPicker(true), 300);
      }
    }
  };

  const handleDateChange = (_: any, selectedDate?: Date) => {
    if (!selectedDate) {
      setShowDatePicker(false);
      return;
    }
    const now = new Date();
    selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    setDate(selectedDate);
    setShowDatePicker(false);
  };

  const formatDate = (d: Date) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
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

  return (
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
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerTitle}>
              {mode === "edit"
                ? "Edit"
                : isInBulkMode
                  ? `${isBulkEdit ? "Edit" : "Expense"} ${pendingIdx + 1} of ${pendingQueue.length}`
                  : "New Transaction"}
            </Text>
          </View>
          {isInBulkMode ? (
            <TouchableOpacity onPress={handleAddAll} style={styles.headerBtn}>
              <Icon name="check-all" type="material-community" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
              <Icon name="check" type="material-community" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          )}
        </View>

        <Animated.View
          style={[{ flex: 1 }, { transform: [{ translateX: slideAnim }] }]}
          {...(isInBulkMode ? panResponder.panHandlers : {})}
        >

        {/* Amount hero */}
        <TouchableOpacity
          style={styles.amountSection}
          activeOpacity={0.8}
          onPress={handleAmountTap}
        >
          {!(showKeyboard && expression) && <Text style={styles.currencySymbol}>₹</Text>}
          <Text style={[
            showKeyboard && expression ? styles.amountExpression : styles.amountText,
            { color: selectedCredit ? COLORS.darkgreen : COLORS.primary },
          ]}>
            {showKeyboard && expression ? expression : (amountNum > 0 ? formatAmountWithCommas(amountNum, false) : "0")}
          </Text>
        </TouchableOpacity>

        {/* Credit/Debit toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, !selectedCredit && styles.toggleBtnActive]}
            onPress={() => { setSelectedCredit(0); dismissAll(); }}
          >
            <Text style={[styles.toggleText, !selectedCredit && styles.toggleTextActive]}>Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, selectedCredit === 1 && styles.toggleBtnActive]}
            onPress={() => { setSelectedCredit(1); dismissAll(); }}
          >
            <Text style={[styles.toggleText, selectedCredit === 1 && styles.toggleTextActive]}>Income</Text>
          </TouchableOpacity>
        </View>

        {/* Details */}
        <ScrollView style={styles.detailsScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Description — standalone */}
          <View style={styles.descriptionRow}>
            <Icon name="pencil-outline" type="material-community" size={20} color={COLORS.darkgray} />
            <TextInput
              ref={descriptionRef}
              style={styles.descriptionInput}
              placeholder="What was it for?"
              placeholderTextColor={COLORS.darkgray}
              value={description}
              onChangeText={setDescription}
              onFocus={() => {
                if (showKeyboard) {
                  const result = evaluateExpression();
                  setAmount(result);
                }
                setShowKeyboard(false);
                setShowDatePicker(false);
                setShowAccountPicker(false);
                catSheetRef.current?.close();
              }}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (!selectedCategory) {
                  setTimeout(() => catSheetRef.current?.open(), 100);
                } else if (!selectedBank) {
                  setShowAccountPicker(true);
                }
              }}
            />
          </View>

          {/* Suggestions */}
          {filteredSuggestions.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.suggestionsScroll}
              contentContainerStyle={styles.suggestionsContent}
              keyboardShouldPersistTaps="handled"
            >
              {filteredSuggestions.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={styles.suggestionChip}
                  onPress={() => setDescription(s)}
                >
                  <Text style={styles.suggestionText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Grouped fields card */}
          <View style={styles.detailsCard}>
            {/* Category */}
            <TouchableOpacity
              style={styles.fieldRow}
              onPress={() => {
                dismissAll();
                setTimeout(() => catSheetRef.current?.open(), 100);
              }}
            >
              {selectedCategory ? (
                <Icon
                  name={selectedCategory.icon_name}
                  type={selectedCategory.icon_type}
                  size={20}
                  color={COLORS.primary}
                />
              ) : (
                <Icon name="tag-outline" type="material-community" size={20} color={COLORS.darkgray} />
              )}
              <Text style={[styles.fieldText, !selectedCategory && styles.fieldPlaceholder]}>
                {selectedCategory
                  ? selectedCategory.name + (selectedSubcategory ? " → " + selectedSubcategory.name : "")
                  : "What kind?"}
              </Text>
              <Icon name="chevron-right" type="material-community" size={20} color={COLORS.gray} />
            </TouchableOpacity>

            {/* Budget hint */}
            {budgetHint && (
              <View style={styles.budgetHint}>
                <Text style={[styles.budgetHintText, { color: budgetHint.remaining >= 0 ? COLORS.darkgreen : COLORS.red2 }]}>
                  {budgetHint.remaining >= 0
                    ? `₹${formatAmountWithCommas(budgetHint.remaining, false)} remaining in ${selectedCategory?.name}`
                    : `₹${formatAmountWithCommas(Math.abs(budgetHint.remaining), false)} over budget in ${selectedCategory?.name}`}
                </Text>
              </View>
            )}

            <View style={styles.fieldDivider} />

            {/* Account */}
            <TouchableOpacity
              style={styles.fieldRow}
              onPress={() => {
                dismissAll();
                setShowAccountPicker(!showAccountPicker);
              }}
            >
              <Icon name="wallet-outline" type="material-community" size={20} color={COLORS.darkgray} />
              <Text style={[styles.fieldText, !selectedBank && styles.fieldPlaceholder]}>
                {selectedBank?.name || "From where?"}
              </Text>
              <Icon name="chevron-right" type="material-community" size={20} color={COLORS.gray} />
            </TouchableOpacity>

            {/* Account picker inline */}
            {showAccountPicker && (
              <View style={styles.inlinePicker}>
                {accounts.map((account) => (
                  <TouchableOpacity
                    key={account.id}
                    style={[styles.pickerItem, selectedBank?.id === account.id && styles.pickerItemActive]}
                    onPress={() => {
                      setSelectedBank(account);
                      setShowAccountPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerItemText, selectedBank?.id === account.id && styles.pickerItemTextActive]}>
                      {account.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.fieldDivider} />

            {/* Date */}
            <TouchableOpacity
              style={styles.fieldRow}
              onPress={() => {
                dismissAll();
                setShowDatePicker(!showDatePicker);
              }}
            >
              <Icon name="calendar-outline" type="material-community" size={20} color={COLORS.darkgray} />
              <Text style={styles.fieldText}>{formatDate(date)}</Text>
              <Icon name="chevron-right" type="material-community" size={20} color={COLORS.gray} />
            </TouchableOpacity>

            {/* Date picker inline inside card */}
            {showDatePicker && (
              <View style={styles.datePickerInline}>
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="inline"
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                  themeVariant={isDark ? "dark" : "light"}
                  style={styles.datePicker}
                />
              </View>
            )}
          </View>

          {/* Error */}
          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          {/* Delete button (edit mode) */}
          {mode === "edit" && (
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Icon name="trash-can-outline" type="material-community" size={18} color={COLORS.red2} />
              <Text style={styles.deleteBtnText}>Delete Transaction</Text>
            </TouchableOpacity>
          )}

          {/* Bulk mode actions */}
          {isInBulkMode && (
            <View style={styles.bulkActions}>
              <TouchableOpacity style={styles.addBtn} onPress={handleSave}>
                <Text style={styles.addBtnText}>{isBulkEdit ? "Save" : "Add"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
                <Text style={styles.skipBtnText}>Skip</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>

        </Animated.View>

        {/* Category Bottom Sheet */}
        <CategoryBottomSheet
          ref={catSheetRef}
          categories={categories}
          onSelect={handleSelectCategory}
        />

        {/* Custom Keyboard */}
        {showKeyboard && (
          <View style={styles.keyboardContainer}>
            <CustomKeyboard
              onKeyPress={(key) => {
                if (key === "Done") {
                  const result = evaluateExpression();
                  setAmount(result);
                  setShowKeyboard(false);
                  advanceToNextEmpty();
                  return;
                }
                const result = onKeyPress(key);
                setAmount(result);
              }}
            />
          </View>
        )}
      </View>
    </Provider>
  );
};

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.white,
    },

    // Header
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: SIZES.padding,
      paddingTop: SIZES.padding * 2.5,
      paddingBottom: SIZES.base,
    },
    headerBtn: {
      padding: 4,
    },
    headerTitle: {
      ...FONTS.h3,
      fontWeight: "600",
      color: COLORS.primary,
    },

    // Amount
    amountSection: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "center",
      paddingVertical: SIZES.padding * 0.8,
    },
    currencySymbol: {
      ...FONTS.h2,
      fontSize: 22,
      color: COLORS.darkgray,
      fontWeight: "400",
      marginRight: 4,
    },
    amountText: {
      fontSize: 40,
      fontWeight: "800",
      letterSpacing: -1.5,
      fontFamily: "Roboto-Bold",
    },
    amountExpression: {
      fontSize: 28,
      fontWeight: "600",
      letterSpacing: -0.5,
      fontFamily: "Roboto-Regular",
    },

    // Toggle
    toggleRow: {
      flexDirection: "row",
      marginHorizontal: SIZES.padding,
      backgroundColor: COLORS.lightGray,
      borderRadius: 10,
      padding: 3,
      marginBottom: SIZES.padding,
    },
    toggleBtn: {
      flex: 1,
      paddingVertical: SIZES.base,
      alignItems: "center",
      borderRadius: 8,
    },
    toggleBtnActive: {
      backgroundColor: COLORS.white,
    },
    toggleText: {
      ...FONTS.body3,
      color: COLORS.darkgray,
    },
    toggleTextActive: {
      color: COLORS.primary,
      fontWeight: "600",
    },

    // Details
    detailsScroll: {
      flex: 1,
      paddingHorizontal: SIZES.padding,
    },
    descriptionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SIZES.base + 2,
      marginBottom: SIZES.base + 4,
      paddingHorizontal: 4,
    },
    descriptionInput: {
      flex: 1,
      ...FONTS.body2,
      color: COLORS.primary,
      fontWeight: "500",
      paddingVertical: SIZES.base,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.gray + "50",
    },
    suggestionsScroll: {
      marginBottom: SIZES.base + 4,
      marginTop: -SIZES.base,
    },
    suggestionsContent: {
      gap: SIZES.base,
      paddingHorizontal: 4,
    },
    suggestionChip: {
      backgroundColor: COLORS.lightGray,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 16,
    },
    suggestionText: {
      ...FONTS.body4,
      fontSize: 13,
      color: COLORS.primary,
      fontWeight: "500",
    },
    detailsCard: {
      backgroundColor: COLORS.lightGray,
      borderRadius: 14,
      overflow: "hidden",
    },
    fieldRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: SIZES.padding * 0.7,
      paddingVertical: SIZES.base + 5,
      gap: SIZES.base + 2,
    },
    budgetHint: {
      paddingHorizontal: SIZES.padding * 0.7 + 32,
      paddingBottom: SIZES.base,
    },
    budgetHintText: {
      ...FONTS.body4,
      fontSize: 12,
    },
    fieldText: {
      ...FONTS.body3,
      color: COLORS.primary,
      fontWeight: "500",
      flex: 1,
    },
    fieldPlaceholder: {
      color: COLORS.darkgray,
      fontWeight: "400",
    },
    fieldDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: COLORS.gray,
      marginHorizontal: SIZES.padding * 0.7,
      opacity: 0.3,
    },

    // Inline pickers
    inlinePicker: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: SIZES.base,
      paddingHorizontal: SIZES.padding * 0.7,
      paddingBottom: SIZES.base + 4,
    },
    pickerItem: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: COLORS.white,
    },
    pickerItemActive: {
      backgroundColor: COLORS.primary,
    },
    pickerItemText: {
      ...FONTS.body4,
      fontWeight: "500",
      color: COLORS.primary,
    },
    pickerItemTextActive: {
      color: COLORS.white,
    },

    // Date picker
    datePickerInline: {
      alignItems: "center",
      paddingBottom: SIZES.base,
    },
    datePicker: {
      height: 320,
    },

    // Error
    errorText: {
      ...FONTS.body4,
      color: COLORS.red2,
      marginTop: SIZES.base + 4,
      marginLeft: 4,
    },

    // Delete
    deleteBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: SIZES.padding,
      paddingVertical: SIZES.base + 4,
    },
    deleteBtnText: {
      ...FONTS.body3,
      color: COLORS.red2,
      fontWeight: "500",
    },

    // Keyboard
    keyboardContainer: {
      backgroundColor: COLORS.white,
    },

    // Bulk mode
    dotsRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
      paddingBottom: 4,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: COLORS.gray,
    },
    dotCurrent: {
      backgroundColor: COLORS.primary,
      width: 18,
      borderRadius: 4,
    },
    bulkActions: {
      marginTop: SIZES.padding,
      gap: 10,
    },
    addBtn: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: COLORS.primary,
      borderRadius: SIZES.radius,
      paddingVertical: 14,
    },
    addBtnText: {
      ...FONTS.h4,
      color: COLORS.white,
    },
    skipBtn: {
      alignItems: "center",
      paddingVertical: 12,
    },
    skipBtnText: {
      ...FONTS.body3,
      color: COLORS.darkgray,
    },
  });

export default TransactionInputScreen;

import React, { useRef, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  Keyboard,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { Provider } from "react-native-paper";
import { FONTS, SIZES } from "../constants";
import { useNavigation, useRoute } from "@react-navigation/native";
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
import DateTimePicker from "@react-native-community/datetimepicker";

const TransactionInputScreen: React.FC = () => {
  const { COLORS, isDark } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const route = useRoute<any>();
  const catSheetRef = useRef(null);
  const descriptionRef = useRef<any>(null);

  const transaction = route.params?.transaction;
  const entryId = route.params?.entryId;
  const mode = route.params?.mode;

  const accountsById = useExpensifyStore((state) => state.accounts);
  const categoriesById = useExpensifyStore((state) => state.categories);
  const addTransactionToUI = useExpensifyStore((state) => state.addTransaction);
  const updateTransactionInUI = useExpensifyStore((state) => state.updateTransactions);
  const deleteTransactionFromUI = useExpensifyStore((state) => state.deleteTransaction);

  const allAccounts = Object.values(accountsById);
  const allCategories = Object.values(categoriesById);
  const categories = allCategories.filter((c) => !c.is_deleted);
  const accounts = allAccounts.filter((a) => !a.is_deleted);

  const navigation = useNavigation();
  const { expression, onKeyPress, evaluateExpression } = useCustomKeyboard(
    transaction?.amount?.toString() || "",
  );

  const [description, setDescription] = useState(transaction?.description || "");
  const [amount, setAmount] = useState(transaction?.amount?.toString() || "0");
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState(transaction?.credit || 0);
  const [selectedBank, setSelectedBank] = useState(
    useExpensifyStore((state) => state.getAccountById(transaction?.account_id)) || null,
  );
  const [selectedCategory, setSelectedCategory] = useState(
    useExpensifyStore((state) => state.getCategoryById(transaction?.category_id)) || null,
  );
  const [selectedSubcategory, setSelectedSubcategory] = useState(
    useExpensifyStore((state) => state.getCategoryById(transaction?.subcategory_id)) || null,
  );
  const [subcategories, setSubcategories] = useState(
    transaction ? getSubcategories(categories, transaction.category_id) : [],
  );
  const [date, setDate] = useState(
    transaction ? new Date(transaction.date_time) : new Date(),
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
    return {
      id: transaction?.id || null,
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

  const handleSave = async () => {
    if (!validate()) return;
    const txn = makeTransactionObject();
    if (mode === "edit") {
      const updated = await updateTransaction(txn);
      updateTransactionInUI(updated);
    } else {
      const added = await addTransaction(txn);
      if (entryId) await linkTransactionToLedgerEntry(added.id, entryId);
      addTransactionToUI(added);
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
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.pop()} style={styles.headerBtn}>
            <Icon name="close" type="material-community" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {mode === "edit" ? "Edit" : "New Transaction"}
          </Text>
          <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
            <Icon name="check" type="material-community" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

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

          <View style={{ height: 120 }} />
        </ScrollView>

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
  });

export default TransactionInputScreen;

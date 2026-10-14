import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Keyboard,
  Alert,
} from "react-native";
import { Provider } from "react-native-paper";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Icon } from "react-native-elements";
import DateTimePicker from "@react-native-community/datetimepicker";
import uuid from "react-native-uuid";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { SIZES, FONTS } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";
import { CustomKeyboard, useCustomKeyboard } from "../components/CustomKeyboard";
import CategoryBottomSheet, { CategoryBottomSheetRef } from "../components/CategoryBottomSheet";
import { useExpensifyStore } from "../store/store";
import { addFundEntry, updateFundEntry, deleteFundEntry } from "../services/Funds";
import { addTransaction, updateTransaction } from "../services/TransactionService";
import { ensureTransactionsLoadedFrom } from "../services/TransactionWindow";
import { formatAmountWithCommas } from "../services/Utils";
import { Fund } from "../types/entity/Fund";
import { FundEntry, FundEntryDirection } from "../types/entity/FundEntry";

const SUGGESTIONS = ["Monthly top-up", "Bonus", "Interest", "Gift", "Emergency withdrawal"];

const rupeesToCents = (rupees: number | string): number => {
  const num = typeof rupees === "string" ? parseFloat(rupees) : rupees;
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
};
const centsToRupees = (cents: number): number => cents / 100;

const formatDate = (d: Date) => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

const AddFundEntryScreen: React.FC = () => {
  const { COLORS, isDark } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const { fund, direction: initialDirection, entry: editEntry } = route.params as {
    fund: Fund;
    direction?: FundEntryDirection;
    entry?: FundEntry;
  };
  const isEditing = editEntry != null;
  const me = useExpensifyStore((s) => s.getUserId());
  const categoriesById = useExpensifyStore((s) => s.categories);
  const accountsById = useExpensifyStore((s) => s.accounts);
  const categories = Object.values(categoriesById).filter((c) => !c.is_deleted);
  const accounts = Object.values(accountsById).filter((a) => !a.is_deleted);
  const addTransactionToUI = useExpensifyStore((s) => s.addTransaction);
  const updateTransactionInUI = useExpensifyStore((s) => s.updateTransactions);

  const [direction, setDirection] = useState<FundEntryDirection>(
    editEntry?.direction ?? initialDirection ?? "CONTRIBUTION",
  );
  const [amount, setAmount] = useState(
    editEntry ? String(centsToRupees(editEntry.amount_cents)) : "0",
  );
  const [showKeyboard, setShowKeyboard] = useState(false);
  const { expression, onKeyPress, evaluateExpression, resetExpression } = useCustomKeyboard("");
  const [note, setNote] = useState(editEntry?.note ?? "");
  const [date, setDate] = useState(editEntry ? new Date(editEntry.created_at) : new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [addToTransaction, setAddToTransaction] = useState(editEntry?.linked_transaction_id != null);
  const [selectedBank, setSelectedBank] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydratingLink, setHydratingLink] = useState(editEntry?.linked_transaction_id != null);

  const catSheetRef = useRef<CategoryBottomSheetRef>(null);

  // Editing an entry that's linked to a transaction — hydrate the account/
  // category fields from it (the transaction can be older than the 6-month
  // hot window, same reasoning as AddSplitScreen's edit-mode hydration).
  useEffect(() => {
    const linkedId = editEntry?.linked_transaction_id;
    if (linkedId == null) return;
    (async () => {
      if (editEntry?.created_at) {
        await ensureTransactionsLoadedFrom(new Date(editEntry.created_at));
      }
      const txn = useExpensifyStore.getState().transactions[String(linkedId)];
      if (txn) {
        setSelectedBank(accountsById[txn.account_id] ?? null);
        setSelectedCategory(categoriesById[txn.subcategory_id || txn.category_id] ?? null);
      }
      setHydratingLink(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissAll = () => {
    Keyboard.dismiss();
    setShowKeyboard(false);
    setShowDatePicker(false);
    setShowAccountPicker(false);
    catSheetRef.current?.close();
  };

  const handleAmountTap = () => {
    dismissAll();
    resetExpression(amount !== "0" ? amount : "");
    setShowKeyboard(true);
  };

  const handleSelectCategory = (category: any) => {
    if (category.is_subcategory) {
      setSelectedCategory(category);
    } else {
      setSelectedCategory(category);
    }
  };

  const handleDateChange = (_: any, selectedDate?: Date) => {
    if (!selectedDate) {
      setShowDatePicker(false);
      return;
    }
    setDate(selectedDate);
    setShowDatePicker(false);
  };

  const handleSave = async () => {
    if (hydratingLink) return; // wait for the linked-transaction fields to hydrate
    const amountCents = rupeesToCents(amount);
    if (amountCents <= 0) {
      setError("Enter an amount");
      return;
    }
    if (addToTransaction && (!selectedBank || !selectedCategory)) {
      setError("Select account and category for the transaction");
      return;
    }
    if (!me) {
      setError("You need to be signed in");
      return;
    }

    const now = new Date().toISOString();
    let linkedTransactionId = editEntry?.linked_transaction_id;

    if (addToTransaction) {
      const txnPayload = {
        id: null as any,
        description: note.trim() || fund.name,
        amount: centsToRupees(amountCents),
        is_credit: direction === "WITHDRAWAL",
        account_id: selectedBank.id,
        category_id: selectedCategory.id,
        subcategory_id: null,
        date_time: date.toISOString(),
      };
      if (isEditing && linkedTransactionId != null) {
        const existing = useExpensifyStore.getState().transactions[String(linkedTransactionId)];
        const updated = await updateTransaction({ ...existing, ...txnPayload, id: linkedTransactionId });
        updateTransactionInUI(updated);
      } else {
        const added = await addTransaction(txnPayload);
        addTransactionToUI(added);
        linkedTransactionId = added.id;
      }
    }

    const entry: FundEntry = {
      id: editEntry?.id ?? (uuid.v4() as string),
      fund_id: fund.id,
      contributor_id: editEntry?.contributor_id ?? me,
      amount_cents: amountCents,
      direction,
      note: note.trim() || undefined,
      linked_transaction_id: linkedTransactionId,
      created_at: editEntry?.created_at ?? date.toISOString(),
      updated_at: now,
      is_deleted: false,
    };

    if (isEditing) {
      await updateFundEntry(entry);
    } else {
      await addFundEntry(entry);
    }
    navigation.pop();
  };

  const handleDelete = () => {
    if (!editEntry) return;
    Alert.alert("Delete entry", "Are you sure? This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteFundEntry(editEntry.id);
          navigation.pop();
        },
      },
    ]);
  };

  const amtFloat = parseFloat(amount) || 0;

  return (
    <BottomSheetModalProvider>
      <Provider>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.pop()} style={styles.headerBtn}>
              <Icon name="close" type="material-community" size={24} color={COLORS.primary} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>{isEditing ? "Edit Entry" : "New Entry"}</Text>
              <Text style={styles.headerSubtitle}>for {fund.name}</Text>
            </View>
            <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
              <Icon name="check" type="material-community" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {/* Amount hero */}
          <TouchableOpacity style={styles.amountSection} activeOpacity={0.8} onPress={handleAmountTap}>
            {!(showKeyboard && expression) && <Text style={styles.currencySymbol}>₹</Text>}
            <Text style={showKeyboard && expression ? styles.amountExpression : styles.amountText}>
              {showKeyboard && expression ? expression : amtFloat > 0 ? formatAmountWithCommas(amtFloat, false) : "0"}
            </Text>
          </TouchableOpacity>

          <ScrollView style={styles.detailsScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Contribute / Withdraw */}
            <View style={styles.directionRow}>
              <TouchableOpacity
                style={[styles.directionPill, direction === "CONTRIBUTION" && styles.directionPillActive]}
                onPress={() => setDirection("CONTRIBUTION")}
              >
                <Text style={[styles.directionLabel, direction === "CONTRIBUTION" && styles.directionLabelActive]}>
                  Contribute
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.directionPill, direction === "WITHDRAWAL" && styles.directionPillActive]}
                onPress={() => setDirection("WITHDRAWAL")}
              >
                <Text style={[styles.directionLabel, direction === "WITHDRAWAL" && styles.directionLabelActive]}>
                  Withdraw
                </Text>
              </TouchableOpacity>
            </View>

            {/* Note */}
            <View style={styles.descriptionRow}>
              <Icon name="pencil-outline" type="material-community" size={20} color={COLORS.darkgray} />
              <TextInput
                style={styles.descriptionInput}
                placeholder="Add a note (optional)"
                placeholderTextColor={COLORS.darkgray}
                value={note}
                onChangeText={setNote}
                returnKeyType="done"
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsScroll} contentContainerStyle={styles.suggestionsContent} keyboardShouldPersistTaps="handled">
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity key={s} style={styles.suggestionChip} onPress={() => setNote(s)}>
                  <Text style={styles.suggestionText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.detailsCard}>
              {/* Date */}
              <TouchableOpacity style={styles.fieldRow} onPress={() => { dismissAll(); setShowDatePicker(!showDatePicker); }}>
                <Icon name="calendar-outline" type="material-community" size={20} color={COLORS.darkgray} />
                <Text style={styles.fieldText}>{formatDate(date)}</Text>
                <Icon name="chevron-right" type="material-community" size={20} color={COLORS.gray} />
              </TouchableOpacity>

              {showDatePicker && (
                <View style={{ alignItems: "center", paddingBottom: SIZES.base }}>
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display="inline"
                    onChange={handleDateChange}
                    maximumDate={new Date()}
                    themeVariant={isDark ? "dark" : "light"}
                    style={{ height: 320 }}
                  />
                </View>
              )}
            </View>

            {/* Add to transaction toggle */}
            <TouchableOpacity style={styles.toggleCard} onPress={() => setAddToTransaction(!addToTransaction)} activeOpacity={0.7}>
              <Icon
                name={addToTransaction ? "checkbox-marked" : "checkbox-blank-outline"}
                type="material-community"
                size={22}
                color={addToTransaction ? COLORS.primary : COLORS.darkgray}
              />
              <Text style={styles.toggleLabel}>
                Also {direction === "WITHDRAWAL" ? "record as income" : "add as a transaction"}
              </Text>
            </TouchableOpacity>

            {addToTransaction && (
              <View style={styles.detailsCard}>
                <TouchableOpacity style={styles.fieldRow} onPress={() => { dismissAll(); setTimeout(() => catSheetRef.current?.open(), 100); }}>
                  {selectedCategory ? (
                    <Icon name={selectedCategory.icon_name} type={selectedCategory.icon_type} size={20} color={COLORS.primary} />
                  ) : (
                    <Icon name="tag-outline" type="material-community" size={20} color={COLORS.darkgray} />
                  )}
                  <Text style={[styles.fieldText, !selectedCategory && styles.fieldPlaceholder]}>
                    {selectedCategory ? selectedCategory.name : "What kind?"}
                  </Text>
                  <Icon name="chevron-right" type="material-community" size={20} color={COLORS.gray} />
                </TouchableOpacity>

                <View style={styles.fieldDivider} />

                <TouchableOpacity style={styles.fieldRow} onPress={() => { dismissAll(); setShowAccountPicker(!showAccountPicker); }}>
                  <Icon name="wallet-outline" type="material-community" size={20} color={COLORS.darkgray} />
                  <Text style={[styles.fieldText, !selectedBank && styles.fieldPlaceholder]}>
                    {selectedBank?.name || (direction === "WITHDRAWAL" ? "Into where?" : "From where?")}
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
                        <Text style={[styles.pickerItemText, selectedBank?.id === account.id && styles.pickerItemTextActive]}>
                          {account.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {error && <Text style={styles.errorText}>{error}</Text>}

            {isEditing && (
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                <Icon name="trash-can-outline" type="material-community" size={18} color={COLORS.red2} />
                <Text style={styles.deleteBtnText}>Delete Entry</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 120 }} />
          </ScrollView>

          <CategoryBottomSheet ref={catSheetRef} categories={categories} onSelect={handleSelectCategory} />

          {showKeyboard && (
            <View style={styles.keyboardContainer}>
              <CustomKeyboard
                onKeyPress={(key) => {
                  if (key === "Done") {
                    const result = evaluateExpression();
                    setAmount(result);
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

    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: SIZES.padding, paddingTop: SIZES.padding * 2.5, paddingBottom: SIZES.base,
    },
    headerBtn: { padding: 4 },
    headerCenter: { alignItems: "center" },
    headerTitle: { ...FONTS.h3, fontWeight: "600", color: COLORS.primary },
    headerSubtitle: { ...FONTS.body4, fontSize: 12, color: COLORS.darkgray, marginTop: 1 },

    amountSection: {
      flexDirection: "row", alignItems: "baseline", justifyContent: "center",
      paddingVertical: SIZES.padding * 0.8,
    },
    currencySymbol: { ...FONTS.h2, fontSize: 22, color: COLORS.darkgray, fontWeight: "400", marginRight: 4 },
    amountText: { fontSize: 40, fontWeight: "800", letterSpacing: -1.5, fontFamily: "Roboto-Bold", color: COLORS.primary },
    amountExpression: { fontSize: 28, fontWeight: "600", letterSpacing: -0.5, fontFamily: "Roboto-Regular", color: COLORS.primary },

    detailsScroll: { flex: 1, paddingHorizontal: SIZES.padding },

    directionRow: { flexDirection: "row", gap: SIZES.base, marginBottom: SIZES.base + 4 },
    directionPill: {
      flex: 1, alignItems: "center", paddingVertical: SIZES.base + 4,
      borderRadius: 12, backgroundColor: COLORS.lightGray,
    },
    directionPillActive: { backgroundColor: COLORS.primary },
    directionLabel: { ...FONTS.body3, fontWeight: "600", color: COLORS.primary },
    directionLabelActive: { color: COLORS.white },

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

    toggleCard: {
      flexDirection: "row", alignItems: "center", gap: SIZES.base + 2,
      backgroundColor: COLORS.lightGray, borderRadius: 12,
      paddingHorizontal: SIZES.padding * 0.7, paddingVertical: SIZES.base + 4,
      marginBottom: SIZES.base + 4,
    },
    toggleLabel: { ...FONTS.body3, fontWeight: "500", color: COLORS.primary },

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

    deleteBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 6, marginTop: SIZES.padding, paddingVertical: SIZES.base + 4,
    },
    deleteBtnText: { ...FONTS.body3, color: COLORS.red2, fontWeight: "500" },

    keyboardContainer: { backgroundColor: COLORS.white },
  });

export default AddFundEntryScreen;

import React, { useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Keyboard,
} from "react-native";
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
import { getSubcategories } from "../services/selectors";
import { addTransaction } from "../services/_TransactionService";
import CustomSplitEditor from "../components/CustomSplitEditor";
import {
  addSplitData,
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

const SplitInputScreen: React.FC = () => {
  const { COLORS, isDark } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const route = useRoute<any>();
  const { userId: otherUserId, userName } = route.params as { userId: string; userName: string };
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

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("0");
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [selectedSplitType, setSelectedSplitType] = useState("");
  const [addSplitPayload, setAddSplitPayload] = useState<SplitPayload>({
    meOwe: 0, mePay: 0, friendPay: 0, frinedOwe: 0,
  });
  const [addToTransaction, setAddToTransaction] = useState(false);
  const [selectedBank, setSelectedBank] = useState<Account | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<any>(null);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { onKeyPress, evaluateExpression } = useCustomKeyboard("");
  const catSheetRef = useRef(null);
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

  const dismissAll = () => {
    setShowKeyboard(false);
    setShowDatePicker(false);
    setShowAccountPicker(false);
    catSheetRef.current?.close();
    bottomSheetModalRef.current?.dismiss();
    customSheetRef.current?.dismiss();
    Keyboard.dismiss();
  };

  const handleAmountTap = () => {
    dismissAll();
    setShowKeyboard(true);
  };

  const handleSelectSplitType = (type: SplitType) => {
    const parsedAmountCents = rupeesToCents(amount);
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

      const ledgerEntry: LedgerEntryRow = {
        id: uuid.v4(), created_at: getNowTimestamp(), updated_at: getNowTimestamp(),
        kind: "SPLIT", is_deleted: false, description, created_by: me, total_cents: amountCents,
      };
      const entryId = ledgerEntry.id as string;
      const lineItems: LineItemRow[] = [
        { entry_id: entryId, user_id: me, amount_cents: addSplitPayload.mePay - addSplitPayload.meOwe, paid_cents: addSplitPayload.mePay, owed_cents: addSplitPayload.meOwe, updated_at: getNowTimestamp() },
        { entry_id: entryId, user_id: otherUserId, amount_cents: addSplitPayload.friendPay - addSplitPayload.frinedOwe, paid_cents: addSplitPayload.friendPay, owed_cents: addSplitPayload.frinedOwe, updated_at: getNowTimestamp() },
      ];
      await addSplitData([ledgerEntry], lineItems);

      if (addToTransaction) {
        const txn = {
          id: null, description, amount: centsToRupees(addSplitPayload.meOwe),
          is_credit: false, account_id: selectedBank!.id, category_id: selectedCategory.id,
          subcategory_id: selectedSubcategory?.id || null, date_time: date.toISOString(),
        };
        const added = await addTransaction(txn);
        addTransactionToUI(added);
        await linkTransactionToLedgerEntry(added.id, entryId);
      }

      let userBalances = { ...userBalancesById };
      userBalances = {
        ...userBalances,
        [otherUserId]: {
          ...userBalances[otherUserId],
          net_cents: userBalances[otherUserId].net_cents + addSplitPayload.frinedOwe - addSplitPayload.friendPay,
        },
      };
      await updateUserBalances(Object.values(userBalances));
      setUserBalancesInUI(Object.values(userBalances));
      navigation.pop();
    } catch (err) { }
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
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.pop()} style={styles.headerBtn}>
              <Icon name="close" type="material-community" size={24} color={COLORS.primary} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Split</Text>
              <Text style={styles.headerSubtitle}>with {userName}</Text>
            </View>
            <TouchableOpacity onPress={addSplit} style={styles.headerBtn}>
              <Icon name="check" type="material-community" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {/* Amount hero */}
          <TouchableOpacity style={styles.amountSection} activeOpacity={0.8} onPress={handleAmountTap}>
            <Text style={styles.currencySymbol}>₹</Text>
            <Text style={styles.amountText}>
              {amtFloat > 0 ? formatAmountWithCommas(amtFloat, false) : "0"}
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
                  dismissAll();
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

            <View style={{ height: 120 }} />
          </ScrollView>

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
                  setTimeout(() => customSheetRef.current?.present(), 200);
                }}
              >
                <Icon name="tune-variant" type="material-community" size={16} color={COLORS.darkgray} />
                <Text style={styles.sheetCustomText}>Custom split</Text>
              </TouchableOpacity>
            </View>
          </BottomSheetModal>

          {/* Custom Split Editor */}
          <BottomSheetModal ref={customSheetRef} snapPoints={["65%"]} backgroundStyle={{ borderRadius: 24, backgroundColor: COLORS.white }}>
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
                    setShowKeyboard(false);
                    return;
                  }
                  setSelectedSplitType("");
                  setAddSplitPayload({ meOwe: 0, mePay: 0, friendPay: 0, frinedOwe: 0 });
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
  });

export default SplitInputScreen;

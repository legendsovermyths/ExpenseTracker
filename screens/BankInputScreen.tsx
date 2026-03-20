import React, { useState, useMemo } from "react";
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
import { FONTS, SIZES } from "../constants";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";
import { Icon } from "react-native-elements";
import subscriptionFrequency from "../constants/subscriptionFrequency";
import { addAccount, updateAccount, deleteAccount } from "../services/AccountService";
import {
  CustomKeyboard,
  useCustomKeyboard,
} from "../components/CustomKeyboard";
import { useExpensifyStore } from "../store/store";
import { Account } from "../types/entity/Account";
import { formatAmountWithCommas } from "../services/Utils";
import DateTimePicker from "@react-native-community/datetimepicker";

const BankInputScreen: React.FC = () => {
  const { COLORS, isDark } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const account: Account | undefined = route.params?.account;
  const mode: "add" | "edit" = route.params?.mode;

  const accountsById = useExpensifyStore((state) => state.accounts);
  const addAccountUI = useExpensifyStore((state) => state.addAccount);
  const updateAccountUI = useExpensifyStore((state) => state.updateAccounts);
  const deleteAccountUI = useExpensifyStore((state) => state.deleteAccount);
  const accounts = Object.values(accountsById);

  const { onKeyPress, evaluateExpression } = useCustomKeyboard(
    account?.amount?.toString() || "",
  );

  const [amount, setAmount] = useState(account?.amount?.toString() || "0");
  const [name, setName] = useState(account?.name || "");
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState(account?.is_credit ? 1 : 0);
  const [date, setDate] = useState(
    account?.due_date ? new Date(account.due_date) : new Date(),
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedFrequency, setSelectedFrequency] = useState<string | null>(
    account?.frequency || null,
  );
  const [showFrequencyPicker, setShowFrequencyPicker] = useState(false);
  const [error, setError] = useState("");

  const dismissAll = () => {
    if (showKeyboard) {
      const result = evaluateExpression();
      setAmount(result);
    }
    setShowKeyboard(false);
    setShowDatePicker(false);
    setShowFrequencyPicker(false);
    Keyboard.dismiss();
  };

  const handleAmountTap = () => {
    dismissAll();
    setShowKeyboard(true);
  };

  const makeAccountObject = (): Partial<Account> => ({
    id: account?.id || undefined,
    name: name.toUpperCase(),
    amount: Number(amount),
    is_credit: Boolean(selectedCredit),
    date_time: account?.date_time || new Date().toISOString(),
    due_date: selectedFrequency ? date.toISOString() : null,
    theme: account?.theme || "Deep",
    frequency: selectedFrequency,
    is_deleted: false,
  });

  const handleSave = async () => {
    if (!name.trim() || !amount.trim()) {
      setError("Name and amount are required");
      return;
    }
    const upperName = name.toUpperCase();
    const duplicate = accounts.find((a) => a.name === upperName && a.id !== account?.id);
    if (duplicate) {
      setError("An account with this name already exists");
      return;
    }
    const obj = makeAccountObject();
    if (mode === "edit") {
      const updated = await updateAccount(obj);
      updateAccountUI(updated);
    } else {
      const added = await addAccount(obj);
      addAccountUI(added);
    }
    navigation.pop();
  };

  const handleDelete = () => {
    Alert.alert(`Delete ${account?.name}`, "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteAccount(account!);
          deleteAccountUI(account!.id);
          navigation.pop();
        },
      },
    ]);
  };

  const handleDateChange = (_: any, selectedDate?: Date) => {
    if (!selectedDate) { setShowDatePicker(false); return; }
    setDate(selectedDate);
    setShowDatePicker(false);
  };

  const formatDate = (d: Date) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };

  const amountNum = parseFloat(amount) || 0;

  return (
    <Provider>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.pop()} style={styles.headerBtn}>
            <Icon name="close" type="material-community" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {mode === "edit" ? "Edit Account" : "New Account"}
          </Text>
          <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
            <Icon name="check" type="material-community" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Amount hero */}
        <TouchableOpacity style={styles.amountSection} activeOpacity={0.8} onPress={handleAmountTap}>
          <Text style={styles.currencySymbol}>₹</Text>
          <Text style={[styles.amountText, { color: amountNum < 0 ? COLORS.red2 : COLORS.primary }]}>
            {amountNum !== 0 ? formatAmountWithCommas(Math.abs(amountNum), false) : "0"}
          </Text>
        </TouchableOpacity>

        {/* Credit/Debit toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, !selectedCredit && styles.toggleBtnActive]}
            onPress={() => { setSelectedCredit(0); dismissAll(); }}
          >
            <Text style={[styles.toggleText, !selectedCredit && styles.toggleTextActive]}>Debit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, selectedCredit === 1 && styles.toggleBtnActive]}
            onPress={() => { setSelectedCredit(1); dismissAll(); }}
          >
            <Text style={[styles.toggleText, selectedCredit === 1 && styles.toggleTextActive]}>Credit</Text>
          </TouchableOpacity>
        </View>

        {/* Details */}
        <ScrollView style={styles.detailsScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Name */}
          <View style={styles.nameRow}>
            <Icon name="bank-outline" type="material-community" size={20} color={COLORS.darkgray} />
            <TextInput
              style={styles.nameInput}
              placeholder="Account name"
              placeholderTextColor={COLORS.darkgray}
              value={name}
              onChangeText={setName}
              autoCapitalize="characters"
              onFocus={() => dismissAll()}
              returnKeyType="done"
            />
          </View>

          {/* Credit-specific fields */}
          {selectedCredit === 1 && (
            <View style={styles.detailsCard}>
              {/* Frequency */}
              <TouchableOpacity
                style={styles.fieldRow}
                onPress={() => { dismissAll(); setShowFrequencyPicker(!showFrequencyPicker); }}
              >
                <Icon name="refresh" type="material-community" size={20} color={COLORS.darkgray} />
                <Text style={[styles.fieldText, !selectedFrequency && styles.fieldPlaceholder]}>
                  {selectedFrequency || "Invoice frequency"}
                </Text>
                <Icon name="chevron-right" type="material-community" size={20} color={COLORS.gray} />
              </TouchableOpacity>

              {showFrequencyPicker && (
                <View style={styles.inlinePicker}>
                  {subscriptionFrequency.map((freq) => (
                    <TouchableOpacity
                      key={freq}
                      style={[styles.pickerItem, selectedFrequency === freq && styles.pickerItemActive]}
                      onPress={() => { setSelectedFrequency(freq); setShowFrequencyPicker(false); }}
                    >
                      <Text style={[styles.pickerItemText, selectedFrequency === freq && styles.pickerItemTextActive]}>
                        {freq}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.fieldDivider} />

              {/* Due date */}
              <TouchableOpacity
                style={styles.fieldRow}
                onPress={() => { dismissAll(); setShowDatePicker(!showDatePicker); }}
              >
                <Icon name="calendar-outline" type="material-community" size={20} color={COLORS.darkgray} />
                <Text style={styles.fieldText}>Due: {formatDate(date)}</Text>
                <Icon name="chevron-right" type="material-community" size={20} color={COLORS.gray} />
              </TouchableOpacity>

              {showDatePicker && (
                <View style={{ alignItems: "center", paddingBottom: SIZES.base }}>
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display="inline"
                    onChange={handleDateChange}
                    themeVariant={isDark ? "dark" : "light"}
                    style={{ height: 320 }}
                  />
                </View>
              )}
            </View>
          )}

          {/* Error */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Delete (edit mode) */}
          {mode === "edit" && (
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Icon name="trash-can-outline" type="material-community" size={18} color={COLORS.red2} />
              <Text style={styles.deleteBtnText}>Delete Account</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>

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
    container: { flex: 1, backgroundColor: COLORS.white },

    // Header
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: SIZES.padding, paddingTop: SIZES.padding * 2.5, paddingBottom: SIZES.base,
    },
    headerBtn: { padding: 4 },
    headerTitle: { ...FONTS.h3, fontWeight: "600", color: COLORS.primary },

    // Amount
    amountSection: {
      flexDirection: "row", alignItems: "baseline", justifyContent: "center",
      paddingVertical: SIZES.padding * 0.8,
    },
    currencySymbol: { ...FONTS.h2, fontSize: 22, color: COLORS.darkgray, fontWeight: "400", marginRight: 4 },
    amountText: { fontSize: 40, fontWeight: "800", letterSpacing: -1.5, fontFamily: "Roboto-Bold", color: COLORS.primary },

    // Toggle
    toggleRow: {
      flexDirection: "row", marginHorizontal: SIZES.padding,
      backgroundColor: COLORS.lightGray, borderRadius: 10, padding: 3, marginBottom: SIZES.padding,
    },
    toggleBtn: { flex: 1, paddingVertical: SIZES.base, alignItems: "center", borderRadius: 8 },
    toggleBtnActive: { backgroundColor: COLORS.white },
    toggleText: { ...FONTS.body3, color: COLORS.darkgray },
    toggleTextActive: { color: COLORS.primary, fontWeight: "600" },

    // Details
    detailsScroll: { flex: 1, paddingHorizontal: SIZES.padding },

    nameRow: {
      flexDirection: "row", alignItems: "center", gap: SIZES.base + 2,
      marginBottom: SIZES.padding, paddingHorizontal: 4,
    },
    nameInput: {
      flex: 1, ...FONTS.body2, color: COLORS.primary, fontWeight: "500",
      paddingVertical: SIZES.base,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.gray + "50",
    },

    // Card
    detailsCard: { backgroundColor: COLORS.lightGray, borderRadius: 14, overflow: "hidden", marginBottom: SIZES.base + 4 },
    fieldRow: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: SIZES.padding * 0.7, paddingVertical: SIZES.base + 5, gap: SIZES.base + 2,
    },
    fieldText: { ...FONTS.body3, color: COLORS.primary, fontWeight: "500", flex: 1 },
    fieldPlaceholder: { color: COLORS.darkgray, fontWeight: "400" },
    fieldDivider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.gray, marginHorizontal: SIZES.padding * 0.7, opacity: 0.3 },

    // Inline picker
    inlinePicker: {
      flexDirection: "row", flexWrap: "wrap", gap: SIZES.base,
      paddingHorizontal: SIZES.padding * 0.7, paddingBottom: SIZES.base + 4,
    },
    pickerItem: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: COLORS.white },
    pickerItemActive: { backgroundColor: COLORS.primary },
    pickerItemText: { ...FONTS.body4, fontSize: 13, fontWeight: "500", color: COLORS.primary },
    pickerItemTextActive: { color: COLORS.white },

    // Error
    errorText: { ...FONTS.body4, color: COLORS.red2, marginTop: SIZES.base, marginLeft: 4 },

    // Delete
    deleteBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 6, marginTop: SIZES.padding, paddingVertical: SIZES.base + 4,
    },
    deleteBtnText: { ...FONTS.body3, color: COLORS.red2, fontWeight: "500" },

    // Keyboard
    keyboardContainer: { backgroundColor: COLORS.white },
  });

export default BankInputScreen;

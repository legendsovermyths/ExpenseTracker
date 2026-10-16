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

import { FONTS, SIZES, FONT } from "../constants";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTheme, ThemedPaperProvider } from "../contexts/ThemeContext";
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

  const { expression, onKeyPress, evaluateExpression } = useCustomKeyboard(
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
      const updated = await updateAccount(obj as Account);
      updateAccountUI(updated);
    } else {
      const added = await addAccount(obj as Account);
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
    <ThemedPaperProvider>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.pop()} style={styles.headerBtn}>
            <Icon name="close" type="material-community" size={24} color={COLORS.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {mode === "edit" ? "Edit Account" : "New Account"}
          </Text>
          <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
            <Icon name="check" type="material-community" size={24} color={COLORS.ink} />
          </TouchableOpacity>
        </View>

        {/* Amount hero */}
        <TouchableOpacity style={styles.amountSection} activeOpacity={0.8} onPress={handleAmountTap}>
          {!(showKeyboard && expression) && <Text style={styles.currencySymbol}>₹</Text>}
          <Text style={[
            showKeyboard && expression ? styles.amountExpression : styles.amountText,
            { color: amountNum < 0 ? COLORS.deltaUp : COLORS.ink },
          ]}>
            {showKeyboard && expression ? expression : (amountNum !== 0 ? formatAmountWithCommas(Math.abs(amountNum), false) : "0")}
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
            <Icon name="bank-outline" type="material-community" size={20} color={COLORS.inkMuted} />
            <TextInput
              style={styles.nameInput}
              placeholder="Account name"
              placeholderTextColor={COLORS.inkMuted}
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
                <Icon name="refresh" type="material-community" size={20} color={COLORS.inkMuted} />
                <Text style={[styles.fieldText, !selectedFrequency && styles.fieldPlaceholder]}>
                  {selectedFrequency || "Invoice frequency"}
                </Text>
                <Icon name="chevron-right" type="material-community" size={20} color={COLORS.inkSubtle} />
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
                <Icon name="calendar-outline" type="material-community" size={20} color={COLORS.inkMuted} />
                <Text style={styles.fieldText}>Due: {formatDate(date)}</Text>
                <Icon name="chevron-right" type="material-community" size={20} color={COLORS.inkSubtle} />
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
              <Icon name="trash-can-outline" type="material-community" size={18} color={COLORS.deltaUp} />
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
                setAmount(String(result));
              }}
            />
          </View>
        )}
      </View>
    </ThemedPaperProvider>
  );
};

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.paper },

    // Header
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: SIZES.padding, paddingTop: SIZES.padding * 2.5, paddingBottom: SIZES.base,
    },
    headerBtn: { padding: 4 },
    headerTitle: { ...FONTS.h3, fontFamily: FONT.bold, color: COLORS.ink },

    // Amount
    amountSection: {
      flexDirection: "row", alignItems: "baseline", justifyContent: "center",
      paddingVertical: SIZES.padding * 0.8,
    },
    currencySymbol: { ...FONTS.h2, fontSize: 22, color: COLORS.inkMuted, fontFamily: FONT.regular, marginRight: 4 },
    amountText: { fontSize: 40, letterSpacing: -1.5, fontFamily: FONT.bold, color: COLORS.ink },
    amountExpression: { fontSize: 28, letterSpacing: -0.5, fontFamily: FONT.regular, color: COLORS.ink },

    // Toggle
    toggleRow: {
      flexDirection: "row", marginHorizontal: SIZES.padding,
      backgroundColor: COLORS.surface1, borderRadius: 10, padding: 3, marginBottom: SIZES.padding,
    },
    toggleBtn: { flex: 1, paddingVertical: SIZES.base, alignItems: "center", borderRadius: 8 },
    toggleBtnActive: { backgroundColor: COLORS.paper },
    toggleText: { ...FONTS.body3, color: COLORS.inkMuted },
    toggleTextActive: { color: COLORS.ink, fontFamily: FONT.bold },

    // Details
    detailsScroll: { flex: 1, paddingHorizontal: SIZES.padding },

    nameRow: {
      flexDirection: "row", alignItems: "center", gap: SIZES.base + 2,
      marginBottom: SIZES.padding, paddingHorizontal: 4,
    },
    nameInput: {
      flex: 1, ...FONTS.body2, color: COLORS.ink, fontFamily: FONT.medium,
      paddingVertical: SIZES.base,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.hairline,
    },

    // Card
    detailsCard: { backgroundColor: COLORS.surface1, borderRadius: 14, overflow: "hidden", marginBottom: SIZES.base + 4 },
    fieldRow: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: SIZES.padding * 0.7, paddingVertical: SIZES.base + 5, gap: SIZES.base + 2,
    },
    fieldText: { ...FONTS.body3, color: COLORS.ink, fontFamily: FONT.medium, flex: 1 },
    fieldPlaceholder: { color: COLORS.inkMuted, fontFamily: FONT.regular },
    fieldDivider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.hairline, marginHorizontal: SIZES.padding * 0.7, opacity: 0.3 },

    // Inline picker
    inlinePicker: {
      flexDirection: "row", flexWrap: "wrap", gap: SIZES.base,
      paddingHorizontal: SIZES.padding * 0.7, paddingBottom: SIZES.base + 4,
    },
    pickerItem: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: COLORS.paper },
    pickerItemActive: { backgroundColor: COLORS.ink },
    pickerItemText: { ...FONTS.body4, fontSize: 13, fontFamily: FONT.medium, color: COLORS.ink },
    pickerItemTextActive: { color: COLORS.paper },

    // Error
    errorText: { ...FONTS.body4, color: COLORS.deltaUp, marginTop: SIZES.base, marginLeft: 4 },

    // Delete
    deleteBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 6, marginTop: SIZES.padding, paddingVertical: SIZES.base + 4,
    },
    deleteBtnText: { ...FONTS.body3, color: COLORS.deltaUp, fontFamily: FONT.medium },

    // Keyboard
    keyboardContainer: { backgroundColor: COLORS.paper },
  });

export default BankInputScreen;

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { FONTS, SIZES } from "../constants";
import { Icon } from "react-native-elements";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";
import { formatAmountWithCommas } from "../services/Utils";

const rupeesToCents = (rupees: number): number => Math.round(rupees * 100);
const centsToRupees = (cents: number): number => cents / 100;

// Format rupees — show decimals only when needed
const fmtRupees = (cents: number): string => {
  const rupees = centsToRupees(cents);
  if (cents % 100 === 0) return formatAmountWithCommas(rupees, false);
  return formatAmountWithCommas(rupees, true);
};

const distributeSplitRemainder = (
  a1: number, a2: number, total: number,
): [number, number] => {
  const rem = total - (a1 + a2);
  if (rem === 0) return [a1, a2];
  return a1 >= a2 ? [a1 + rem, a2] : [a1, a2 + rem];
};

type FieldKey = "paidMe" | "paidFriend" | "oweMe" | "oweFriend";

interface CSEProps {
  total: number;
  meName: string;
  friendName: string;
  onDone: (paidMe: number, paidFriend: number, oweMe: number, oweFriend: number) => void;
}

const CustomSplitEditor: React.FC<CSEProps> = ({ total, meName, friendName, onDone }) => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const totalCents = rupeesToCents(total);
  const inputRef = useRef<TextInput>(null);

  const [paidMeCents, setPaidMeCents] = useState(totalCents);
  const [paidFriendCents, setPaidFriendCents] = useState(0);
  const [oweMeCents, setOweMeCents] = useState(Math.floor(totalCents / 2));
  const [oweFriendCents, setOweFriendCents] = useState(totalCents - Math.floor(totalCents / 2));
  const [oweMePercent, setOweMePercent] = useState(50);
  const [oweFriendPercent, setOweFriendPercent] = useState(50);
  const [oweMeParts, setOweMeParts] = useState(1);
  const [oweFriendParts, setOweFriendParts] = useState(1);

  const [owedMode, setOwedMode] = useState<"amount" | "percentage" | "parts">("amount");
  const [activeField, setActiveField] = useState<FieldKey>("oweMe");
  const [inputText, setInputText] = useState("");

  useEffect(() => {
    const tc = rupeesToCents(total);
    const half = Math.floor(tc / 2);
    setPaidMeCents(tc);
    setPaidFriendCents(0);
    setOweMeCents(half + (tc - half * 2));
    setOweFriendCents(half);
  }, [total]);

  useEffect(() => {
    if (owedMode === "percentage") {
      const tp = oweMePercent + oweFriendPercent;
      if (tp > 0) {
        const mc = Math.floor((oweMePercent / tp) * totalCents);
        setOweMeCents(mc);
        setOweFriendCents(totalCents - mc);
      }
    }
  }, [oweMePercent, oweFriendPercent, owedMode, totalCents]);

  useEffect(() => {
    if (owedMode === "parts") {
      const tp = oweMeParts + oweFriendParts;
      if (tp > 0) {
        const mc = Math.floor((oweMeParts / tp) * totalCents);
        setOweMeCents(mc);
        setOweFriendCents(totalCents - mc);
      }
    }
  }, [oweMeParts, oweFriendParts, owedMode, totalCents]);

  const switchOwedMode = (newMode: "amount" | "percentage" | "parts") => {
    if (newMode === "percentage" && totalCents > 0) {
      setOweMePercent(Math.round((oweMeCents / totalCents) * 100));
      setOweFriendPercent(Math.round((oweFriendCents / totalCents) * 100));
    } else if (newMode === "parts" && totalCents > 0) {
      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
      if (oweMeCents > 0 && oweFriendCents > 0) {
        const g = gcd(oweMeCents, oweFriendCents);
        setOweMeParts(oweMeCents / g);
        setOweFriendParts(oweFriendCents / g);
      }
    }
    setOwedMode(newMode);
    if (activeField === "oweMe" || activeField === "oweFriend") {
      selectField(activeField, newMode);
    }
  };

  const getDisplayValue = (key: FieldKey): string => {
    switch (key) {
      case "paidMe": return `₹${fmtRupees(paidMeCents)}`;
      case "paidFriend": return `₹${fmtRupees(paidFriendCents)}`;
      case "oweMe":
        if (owedMode === "percentage") return `${oweMePercent}%`;
        if (owedMode === "parts") return `${oweMeParts} parts`;
        return `₹${fmtRupees(oweMeCents)}`;
      case "oweFriend":
        if (owedMode === "percentage") return `${oweFriendPercent}%`;
        if (owedMode === "parts") return `${oweFriendParts} parts`;
        return `₹${fmtRupees(oweFriendCents)}`;
    }
  };

  const getRawValue = (key: FieldKey, mode?: string): string => {
    const m = mode || owedMode;
    switch (key) {
      case "paidMe": return centsToRupees(paidMeCents).toString();
      case "paidFriend": return centsToRupees(paidFriendCents).toString();
      case "oweMe":
        if (m === "percentage") return oweMePercent.toString();
        if (m === "parts") return oweMeParts.toString();
        return centsToRupees(oweMeCents).toString();
      case "oweFriend":
        if (m === "percentage") return oweFriendPercent.toString();
        if (m === "parts") return oweFriendParts.toString();
        return centsToRupees(oweFriendCents).toString();
    }
  };

  const selectField = (key: FieldKey, mode?: string) => {
    setActiveField(key);
    setInputText(getRawValue(key, mode));
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const commitValue = (text: string, field: FieldKey) => {
    const num = parseFloat(text);
    if (isNaN(num)) return;
    switch (field) {
      case "paidMe": setPaidMeCents(rupeesToCents(num)); break;
      case "paidFriend": setPaidFriendCents(rupeesToCents(num)); break;
      case "oweMe":
        if (owedMode === "percentage") setOweMePercent(num);
        else if (owedMode === "parts") setOweMeParts(num);
        else setOweMeCents(rupeesToCents(num));
        break;
      case "oweFriend":
        if (owedMode === "percentage") setOweFriendPercent(num);
        else if (owedMode === "parts") setOweFriendParts(num);
        else setOweFriendCents(rupeesToCents(num));
        break;
    }
  };

  const handleInputChange = (text: string) => {
    // Normalize comma to dot for locales that use comma as decimal
    const normalized = text.replace(",", ".");
    if (/^(\d+)?(\.\d*)?$/.test(normalized)) {
      setInputText(normalized);
      commitValue(normalized, activeField);
    }
  };

  const remainingPaid = totalCents - (paidMeCents + paidFriendCents);
  const remainingOwed = totalCents - (oweMeCents + oweFriendCents);

  const isValid = () => {
    const paidOk = Math.abs(remainingPaid) < 1;
    if (owedMode === "percentage") return paidOk && Math.abs(oweMePercent + oweFriendPercent - 100) < 0.1;
    return paidOk && Math.abs(remainingOwed) < 1;
  };

  const handleDone = () => {
    const [fp1, fp2] = distributeSplitRemainder(paidMeCents, paidFriendCents, totalCents);
    const [fo1, fo2] = distributeSplitRemainder(oweMeCents, oweFriendCents, totalCents);
    onDone(centsToRupees(fp1), centsToRupees(fp2), centsToRupees(fo1), centsToRupees(fo2));
  };

  const fieldLabel = (key: FieldKey): string => {
    switch (key) {
      case "paidMe": case "oweMe": return meName;
      case "paidFriend": case "oweFriend": return friendName;
    }
  };

  const inputDescription = (key: FieldKey): string => {
    const name = fieldLabel(key);
    const isMe = key === "paidMe" || key === "oweMe";
    if (key.startsWith("paid")) return `${name} paid`;
    return isMe ? `${name} owe` : `${name} owes`;
  };

  const renderRow = (key: FieldKey) => {
    const isActive = activeField === key;
    return (
      <TouchableOpacity
        key={key}
        style={[styles.row, isActive && styles.rowActive]}
        onPress={() => selectField(key)}
        activeOpacity={0.7}
      >
        <Text style={[styles.rowLabel, isActive && { color: COLORS.primary, fontWeight: "600" }]}>
          {fieldLabel(key)}
        </Text>
        <Text style={[styles.rowValue, isActive && { color: COLORS.primary }]}>
          {getDisplayValue(key)}
        </Text>
      </TouchableOpacity>
    );
  };

  const modeLabels: { key: "amount" | "percentage" | "parts"; label: string }[] = [
    { key: "amount", label: "₹" },
    { key: "percentage", label: "%" },
    { key: "parts", label: "Ratio" },
  ];

  const getSuffix = (): string => {
    if (activeField === "paidMe" || activeField === "paidFriend") return "";
    if (owedMode === "percentage") return "%";
    if (owedMode === "parts") return " parts";
    return "";
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={60}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Custom Split</Text>
          <View style={styles.headerRight}>
            <Text style={styles.totalAmount}>₹{formatAmountWithCommas(total, false)}</Text>
            <TouchableOpacity
              onPress={handleDone}
              disabled={!isValid()}
              style={[styles.tickBtn, !isValid() && { opacity: 0.3 }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="check" type="material-community" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Who paid */}
        <Text style={styles.sectionTitle}>Who paid?</Text>
        <View style={styles.card}>
          {renderRow("paidMe")}
          <View style={styles.divider} />
          {renderRow("paidFriend")}
        </View>
        {Math.abs(remainingPaid) >= 1 && (
          <Text style={[styles.remainingText, remainingPaid < 0 && { color: COLORS.red2 }]}>
            {remainingPaid > 0
              ? `₹${fmtRupees(remainingPaid)} remaining`
              : `₹${fmtRupees(Math.abs(remainingPaid))} over`}
          </Text>
        )}

        {/* Who owes */}
        <View style={styles.owedHeader}>
          <Text style={styles.sectionTitle}>Who owes?</Text>
          <View style={styles.modePills}>
            {modeLabels.map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[styles.modePill, owedMode === m.key && styles.modePillActive]}
                onPress={() => switchOwedMode(m.key)}
              >
                <Text style={[styles.modePillText, owedMode === m.key && styles.modePillTextActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.card}>
          {renderRow("oweMe")}
          <View style={styles.divider} />
          {renderRow("oweFriend")}
        </View>

        {owedMode !== "amount" && (
          <Text style={styles.previewText}>
            {meName}: ₹{fmtRupees(oweMeCents)}  ·  {friendName}: ₹{fmtRupees(oweFriendCents)}
          </Text>
        )}
        {owedMode === "amount" && Math.abs(remainingOwed) >= 1 && (
          <Text style={[styles.remainingText, remainingOwed < 0 && { color: COLORS.red2 }]}>
            {remainingOwed > 0
              ? `₹${fmtRupees(remainingOwed)} remaining`
              : `₹${fmtRupees(Math.abs(remainingOwed))} over`}
          </Text>
        )}

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Input area */}
        <View style={styles.inputArea}>
          <Text style={styles.inputLabel}>
            {inputDescription(activeField)}
          </Text>
          <View style={styles.inputRow}>
            {(activeField.startsWith("paid") || owedMode === "amount") && (
              <Text style={styles.inputPrefix}>₹</Text>
            )}
            <TextInput
              ref={inputRef}
              style={styles.inputField}
              value={inputText}
              onChangeText={handleInputChange}
              keyboardType="decimal-pad"
              selectTextOnFocus
            />
            {getSuffix() !== "" && (
              <Text style={styles.inputSuffix}>{getSuffix()}</Text>
            )}
          </View>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
};

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: SIZES.padding,
      paddingTop: SIZES.base,
    },

    // Header
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: SIZES.padding / 2,
    },
    headerTitle: { ...FONTS.h3, fontWeight: "700", color: COLORS.primary },
    headerRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: SIZES.base + 4,
    },
    totalAmount: { ...FONTS.body3, fontWeight: "600", color: COLORS.darkgray },
    tickBtn: { padding: 2 },

    // Section
    sectionTitle: {
      ...FONTS.h3, fontWeight: "700", color: COLORS.primary,
      letterSpacing: -0.2, marginBottom: SIZES.base,
    },

    // Card
    card: {
      backgroundColor: COLORS.lightGray, borderRadius: 14,
      overflow: "hidden", marginBottom: SIZES.base,
    },
    divider: {
      height: StyleSheet.hairlineWidth, backgroundColor: COLORS.gray,
      marginHorizontal: SIZES.padding * 0.7, opacity: 0.3,
    },

    // Row
    row: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: SIZES.padding * 0.7, paddingVertical: SIZES.base + 5,
    },
    rowActive: {
      backgroundColor: COLORS.primary + "08",
    },
    rowLabel: { ...FONTS.body3, fontWeight: "500", color: COLORS.darkgray },
    rowValue: { ...FONTS.body4, fontSize: 14, fontWeight: "600", color: COLORS.primary },

    // Remaining
    remainingText: {
      ...FONTS.body4, fontSize: 12, color: COLORS.darkgray,
      textAlign: "center", marginBottom: SIZES.base,
    },

    // Owed header
    owedHeader: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      marginTop: SIZES.base, marginBottom: SIZES.base,
    },
    modePills: {
      flexDirection: "row", backgroundColor: COLORS.lightGray,
      borderRadius: 8, padding: 2,
    },
    modePill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6 },
    modePillActive: { backgroundColor: COLORS.white },
    modePillText: { ...FONTS.body4, fontSize: 12, fontWeight: "500", color: COLORS.darkgray },
    modePillTextActive: { color: COLORS.primary, fontWeight: "700" },

    // Preview
    previewText: {
      ...FONTS.body4, fontSize: 12, color: COLORS.darkgray,
      textAlign: "center", marginBottom: SIZES.base,
    },

    // Input area
    inputArea: {
      backgroundColor: COLORS.lightGray,
      borderRadius: 14,
      paddingHorizontal: SIZES.padding,
      paddingVertical: SIZES.base + 4,
      marginBottom: SIZES.base + 4,
    },
    inputLabel: {
      ...FONTS.body4, fontSize: 12, color: COLORS.darkgray, marginBottom: 4,
    },
    inputRow: {
      flexDirection: "row", alignItems: "baseline",
    },
    inputPrefix: {
      ...FONTS.h2, fontSize: 20, color: COLORS.darkgray, fontWeight: "400", marginRight: 4,
    },
    inputField: {
      ...FONTS.h1, fontSize: 28, fontWeight: "800", color: COLORS.primary,
      flex: 1, padding: 0, letterSpacing: -1,
    },
    inputSuffix: {
      ...FONTS.body3, color: COLORS.darkgray, marginLeft: 4,
    },

  });

export default CustomSplitEditor;

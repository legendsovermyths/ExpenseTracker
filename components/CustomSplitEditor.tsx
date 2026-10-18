import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SPACE, TYPE } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { formatAmountWithCommas, formatCurrency } from "../services/Utils";
import { HeaderTextButton, Pressable, RowGroup, SectionLabel, SegmentedControl, Text } from "./ui";

import { getCurrencySymbol, useCurrency } from "../constants/currency";
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
  const currency = useCurrency();
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
      case "paidMe": return `${getCurrencySymbol()}${fmtRupees(paidMeCents)}`;
      case "paidFriend": return `${getCurrencySymbol()}${fmtRupees(paidFriendCents)}`;
      case "oweMe":
        if (owedMode === "percentage") return `${oweMePercent}%`;
        if (owedMode === "parts") return `${oweMeParts} parts`;
        return `${getCurrencySymbol()}${fmtRupees(oweMeCents)}`;
      case "oweFriend":
        if (owedMode === "percentage") return `${oweFriendPercent}%`;
        if (owedMode === "parts") return `${oweFriendParts} parts`;
        return `${getCurrencySymbol()}${fmtRupees(oweFriendCents)}`;
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
      <Pressable key={key} scale={false} style={styles.row} onPress={() => selectField(key)}>
        <Text variant="headline" tone={isActive ? "ink" : "muted"} style={styles.flex} numberOfLines={1}>
          {fieldLabel(key)}
        </Text>
        <Text variant="amount" tone={isActive ? "accent" : "ink"}>
          {getDisplayValue(key)}
        </Text>
      </Pressable>
    );
  };

  const modeLabels: { key: "amount" | "percentage" | "parts"; label: string }[] = [
    { key: "amount", label: getCurrencySymbol() },
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
          <View style={styles.flex}>
            <Text variant="title">Custom split</Text>
            <Text variant="callout" tone="muted">
              {formatCurrency(total, false)} total
            </Text>
          </View>
          <HeaderTextButton label="Done" emphasis onPress={handleDone} disabled={!isValid()} />
        </View>

        {/* Who paid */}
        <SectionLabel title="Who paid?" />
        <RowGroup>
          {renderRow("paidMe")}
          {renderRow("paidFriend")}
        </RowGroup>
        {Math.abs(remainingPaid) >= 1 && (
          <Text variant="caption" tone={remainingPaid < 0 ? "up" : "muted"} align="center" style={styles.note}>
            {remainingPaid > 0
              ? `${getCurrencySymbol()}${fmtRupees(remainingPaid)} remaining`
              : `${getCurrencySymbol()}${fmtRupees(Math.abs(remainingPaid))} over`}
          </Text>
        )}

        {/* Who owes */}
        <SectionLabel
          title="Who owes?"
          right={
            <SegmentedControl
              size="sm"
              value={owedMode}
              onChange={switchOwedMode}
              options={modeLabels}
              style={styles.modes}
            />
          }
        />
        <RowGroup>
          {renderRow("oweMe")}
          {renderRow("oweFriend")}
        </RowGroup>

        {owedMode !== "amount" && (
          <Text variant="caption" tone="muted" align="center" style={styles.note}>
            {meName}: {getCurrencySymbol()}{fmtRupees(oweMeCents)}  ·  {friendName}: {getCurrencySymbol()}{fmtRupees(oweFriendCents)}
          </Text>
        )}
        {owedMode === "amount" && Math.abs(remainingOwed) >= 1 && (
          <Text variant="caption" tone={remainingOwed < 0 ? "up" : "muted"} align="center" style={styles.note}>
            {remainingOwed > 0
              ? `${getCurrencySymbol()}${fmtRupees(remainingOwed)} remaining`
              : `${getCurrencySymbol()}${fmtRupees(Math.abs(remainingOwed))} over`}
          </Text>
        )}

        {/* Spacer */}
        <View style={styles.flex} />

        {/* Input area */}
        <View style={[styles.inputArea, { borderTopColor: COLORS.hairline }]}>
          <Text variant="caption" tone="muted">
            {inputDescription(activeField)}
          </Text>
          <View style={styles.inputRow}>
            {(activeField.startsWith("paid") || owedMode === "amount") && (
              <Text variant="title" tone="subtle" style={styles.inputPrefix}>
                {currency.symbol}
              </Text>
            )}
            <TextInput
              ref={inputRef}
              style={[TYPE.amountLarge, styles.inputField, { color: COLORS.ink }]}
              value={inputText}
              onChangeText={handleInputChange}
              keyboardType="decimal-pad"
              selectTextOnFocus
              selectionColor={COLORS.accent}
            />
            {getSuffix() !== "" && (
              <Text variant="body" tone="muted" style={styles.inputSuffix}>
                {getSuffix()}
              </Text>
            )}
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: SPACE.gutter, paddingTop: SPACE.xs },
  headerRow: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: 52,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
  },
  note: { marginTop: SPACE.sm },
  modes: { width: 150 },
  inputArea: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: SPACE.md,
    paddingBottom: SPACE.lg,
  },
  inputRow: { flexDirection: "row", alignItems: "baseline", marginTop: SPACE.xs },
  inputPrefix: { marginRight: SPACE.xs },
  inputField: { flex: 1, padding: 0, margin: 0 },
  inputSuffix: { marginLeft: SPACE.xs },
});

export default CustomSplitEditor;

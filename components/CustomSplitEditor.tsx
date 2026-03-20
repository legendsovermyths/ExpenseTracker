import React, { useState, useEffect, useMemo } from "react";
import { View, StyleSheet, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Button, TextInput, DefaultTheme } from "react-native-paper";
import { SIZES } from "../constants";
import { NumberField } from "./NumberField";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";

const rupeesToCents = (rupees: number): number => {
  return Math.round(rupees * 100);
};

const centsToRupees = (cents: number): number => {
  return cents / 100;
};

const distributeSplitRemainder = (
  amount1: number,
  amount2: number,
  totalCents: number
): [number, number] => {
  const sumCents = amount1 + amount2;
  const remainderCents = totalCents - sumCents;
  
  if (remainderCents === 0) {
    return [amount1, amount2];
  }
  
  if (amount1 >= amount2) {
    return [amount1 + remainderCents, amount2];
  } else {
    return [amount1, amount2 + remainderCents];
  }
};

interface CSEProps {
  total: number; // rupees
  meName: string;
  friendName: string;
  onDone: (
    paidMe: number,
    paidFriend: number,
    oweMe: number,
    oweFriend: number,
  ) => void;
}

const CustomSplitEditor: React.FC<CSEProps> = ({
  total,
  meName,
  friendName,
  onDone,
}) => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const totalCents = rupeesToCents(total);
  
  const [tab, setTab] = useState<"paid" | "owed">("owed");
  const [owedTab, setOwedTab] = useState<"amount" | "percentage" | "parts">(
    "amount",
  );
  
  // Store values in cents for precision
  const [paidMeCents, setPaidMeCents] = useState<number>(totalCents);
  const [paidFriendCents, setPaidFriendCents] = useState<number>(0);
  const [oweMeCents, setOweMeCents] = useState<number>(Math.floor(totalCents / 2));
  const [oweFriendCents, setOweFriendCents] = useState<number>(totalCents - Math.floor(totalCents / 2));

  const [oweMePercent, setOweMePercent] = useState<number>(50);
  const [oweFriendPercent, setOweFriendPercent] = useState<number>(50);

  const [oweMeParts, setOweMeParts] = useState<number>(1);
  const [oweFriendParts, setOweFriendParts] = useState<number>(1);

  const remainingPaidCents = totalCents - (paidMeCents + paidFriendCents);
  const remainingOwedCents = totalCents - (oweMeCents + oweFriendCents);

  // Initialize with proper split when total changes
  useEffect(() => {
    const newTotalCents = rupeesToCents(total);
    const halfCents = Math.floor(newTotalCents / 2);
    const remainderCents = newTotalCents - (halfCents * 2);
    
    setPaidMeCents(newTotalCents);
    setPaidFriendCents(0);
    setOweMeCents(halfCents + remainderCents); // Give remainder to first person
    setOweFriendCents(halfCents);
  }, [total]);

  useEffect(() => {
    if (owedTab === "percentage") {
      const totalPercent = oweMePercent + oweFriendPercent;
      if (totalPercent > 0) {
        const oweMeRatio = oweMePercent / totalPercent;
        const oweFriendRatio = oweFriendPercent / totalPercent;
        
        const calcOweMeCents = Math.floor(oweMeRatio * totalCents);
        const calcOweFriendCents = totalCents - calcOweMeCents; // Ensure they add up
        
        setOweMeCents(calcOweMeCents);
        setOweFriendCents(calcOweFriendCents);
      }
    }
  }, [oweMePercent, oweFriendPercent, owedTab, totalCents]);

  useEffect(() => {
    if (owedTab === "parts") {
      const totalParts = oweMeParts + oweFriendParts;
      if (totalParts > 0) {
        const oweMeRatio = oweMeParts / totalParts;
        const oweFriendRatio = oweFriendParts / totalParts;
        
        const calcOweMeCents = Math.floor(oweMeRatio * totalCents);
        const calcOweFriendCents = totalCents - calcOweMeCents; // Ensure they add up
        
        setOweMeCents(calcOweMeCents);
        setOweFriendCents(calcOweFriendCents);
      }
    }
  }, [oweMeParts, oweFriendParts, owedTab, totalCents]);

  const numInput = (
    value: number,
    setValue: React.Dispatch<React.SetStateAction<number>>,
    prefix: string = "",
    suffix: string = "",
    isCents: boolean = false,
  ) => (
    <NumberField
      value={isCents ? centsToRupees(value) : value}
      onChange={(newValue) => {
        if (isCents) {
          const newCents = rupeesToCents(newValue);
          setValue(newCents);
        } else {
          setValue(newValue);
        }
      }}
      prefix={prefix}
      suffix={suffix}
    />
  );

  const renderPaid = () => (
    <>
      <View style={styles.row}>
        <Text style={styles.label}>{meName} paid</Text>
        {numInput(paidMeCents, setPaidMeCents, "₹", "", true)}
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{friendName} paid</Text>
        {numInput(paidFriendCents, setPaidFriendCents, "₹", "", true)}
      </View>
      <Text style={styles.remaining}>
        Amount remaining: ₹{centsToRupees(remainingPaidCents).toFixed(2)}
      </Text>
    </>
  );

  const switchOwedTab = (newTab: "amount" | "percentage" | "parts") => {
    if (newTab === "percentage" && totalCents > 0) {
      setOweMePercent(Math.round((oweMeCents / totalCents) * 100));
      setOweFriendPercent(Math.round((oweFriendCents / totalCents) * 100));
    } else if (newTab === "parts" && totalCents > 0) {
      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
      if (oweMeCents > 0 && oweFriendCents > 0) {
        const g = gcd(oweMeCents, oweFriendCents);
        setOweMeParts(oweMeCents / g);
        setOweFriendParts(oweFriendCents / g);
      }
    }
    setOwedTab(newTab);
  };

  const renderOwedTabs = () => (
    <View style={styles.owedTabsContainer}>
      <TouchableOpacity
        style={[styles.owedTab, owedTab === "amount" && styles.activeOwedTab]}
        onPress={() => switchOwedTab("amount")}
      >
        <Text
          style={[
            styles.owedTabText,
            owedTab === "amount" && styles.activeOwedTabText,
          ]}
        >
          ₹
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.owedTab,
          owedTab === "percentage" && styles.activeOwedTab,
        ]}
        onPress={() => switchOwedTab("percentage")}
      >
        <Text
          style={[
            styles.owedTabText,
            owedTab === "percentage" && styles.activeOwedTabText,
          ]}
        >
          %
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.owedTab, owedTab === "parts" && styles.activeOwedTab]}
        onPress={() => switchOwedTab("parts")}
      >
        <Text
          style={[
            styles.owedTabText,
            owedTab === "parts" && styles.activeOwedTabText,
          ]}
        >
          ⚖
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderOwed = () => (
    <>
      {renderOwedTabs()}

      {owedTab === "amount" && (
        <>
          <View style={styles.row}>
            <Text style={styles.label}>{meName}</Text>
            {numInput(oweMeCents, setOweMeCents, "₹", "", true)}
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{friendName}</Text>
            {numInput(oweFriendCents, setOweFriendCents, "₹", "", true)}
          </View>
          <Text style={styles.remaining}>
            Amount remaining: ₹{centsToRupees(remainingOwedCents).toFixed(2)}
          </Text>
        </>
      )}

      {owedTab === "percentage" && (
        <>
          <View style={styles.row}>
            <Text style={styles.label}>{meName}</Text>
            {numInput(oweMePercent, setOweMePercent, "", "%")}
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{friendName}</Text>
            {numInput(oweFriendPercent, setOweFriendPercent, "", "%")}
          </View>
          <Text style={[
            styles.remaining,
            Math.abs((oweMePercent + oweFriendPercent) - 100) > 0.1 && { color: COLORS.darkgray }
          ]}>
            Total: {(oweMePercent + oweFriendPercent).toFixed(1)}%
            {Math.abs((oweMePercent + oweFriendPercent) - 100) > 0.1 && " (must equal 100%)"}
          </Text>
          <Text style={styles.preview}>
            {meName}: ₹{centsToRupees(oweMeCents).toFixed(2)} | {friendName}: ₹
            {centsToRupees(oweFriendCents).toFixed(2)}
          </Text>
        </>
      )}

      {owedTab === "parts" && (
        <>
          <View style={styles.row}>
            <Text style={styles.label}>{meName}</Text>
            {numInput(oweMeParts, setOweMeParts, "", " share(s)")}
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{friendName}</Text>
            {numInput(oweFriendParts, setOweFriendParts, "", " share(s)")}
          </View>
          <Text style={styles.remaining}>
            Total: {(oweMeParts + oweFriendParts).toFixed(1)} shares
          </Text>
          <Text style={styles.preview}>
            {meName}: ₹{centsToRupees(oweMeCents).toFixed(2)} | {friendName}: ₹
            {centsToRupees(oweFriendCents).toFixed(2)}
          </Text>
        </>
      )}
    </>
  );

  const isValidSplit = () => {
    if (tab === "paid") {
      return Math.abs(remainingPaidCents) < 1; // Allow for 1 cent difference due to rounding
    } else {
      if (owedTab === "percentage") {
        const totalPercent = oweMePercent + oweFriendPercent;
        return Math.abs(totalPercent - 100) < 0.1; // Allow for small rounding differences
      } else {
        return Math.abs(remainingOwedCents) < 1;
      }
    }
  };

  const handleDone = () => {
    let finalPaidMeCents = paidMeCents;
    let finalPaidFriendCents = paidFriendCents;
    let finalOweMeCents = oweMeCents;
    let finalOweFriendCents = oweFriendCents;

    // Ensure paid amounts add up to total
    if (tab === "paid") {
      [finalPaidMeCents, finalPaidFriendCents] = distributeSplitRemainder(
        paidMeCents,
        paidFriendCents,
        totalCents
      );
    }

    // Ensure owed amounts add up to total
    [finalOweMeCents, finalOweFriendCents] = distributeSplitRemainder(
      oweMeCents,
      oweFriendCents,
      totalCents
    );

    onDone(
      centsToRupees(finalPaidMeCents),
      centsToRupees(finalPaidFriendCents),
      centsToRupees(finalOweMeCents),
      centsToRupees(finalOweFriendCents)
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={80}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.tabRow}>
          <Button
            mode={tab === "paid" ? "contained" : "text"}
            onPress={() => setTab("paid")}
            textColor={tab === "paid" ? COLORS.white : COLORS.primary}
            buttonColor={tab === "paid" ? COLORS.primary : COLORS.white}
            style={{ marginRight: SIZES.padding / 2 }}
          >
            Paid amount
          </Button>
          <Button
            mode={tab === "owed" ? "contained" : "text"}
            textColor={tab === "owed" ? COLORS.white : COLORS.primary}
            buttonColor={tab === "owed" ? COLORS.primary : COLORS.white}
            onPress={() => setTab("owed")}
            style={{ marginLeft: SIZES.padding / 2 }}
          >
            Owed amount
          </Button>
        </View>

        {tab === "paid" ? renderPaid() : renderOwed()}

        <Button
          mode="contained"
          buttonColor={COLORS.primary}
          style={{ marginTop: 16, borderRadius: 20 }}
          onPress={handleDone}
          disabled={!isValidSplit()}
        >
          Done
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (COLORS: ColorPalette) => StyleSheet.create({
  tabRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 6,
    paddingHorizontal: 8,
  },
  label: {
    fontSize: 16,
    color: COLORS.primary,
    flex: 1,
  },
  inputContainer: {
    borderBottomWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 100,
    alignItems: "flex-end",
  },
  inputText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: "500",
  },
  remaining: {
    textAlign: "center",
    color: COLORS.darkgray,
    marginTop: 8,
    fontSize: 14,
  },
  preview: {
    textAlign: "center",
    color: COLORS.primary,
    marginTop: 4,
    fontSize: 12,
    fontWeight: "500",
  },
  owedTabsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 16,
    backgroundColor: COLORS.white,
    borderRadius: 25,
    padding: 4,
  },
  owedTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginHorizontal: 2,
    minWidth: 50,
    alignItems: "center",
  },
  input: {
    borderBottomWidth: 1,
    borderColor: COLORS.darkgray,
    width: 100,
    textAlign: "right",
    fontSize: 16,
  },
  activeOwedTab: {
    backgroundColor: COLORS.primary,
  },
  owedTabText: {
    fontSize: 16,
    color: COLORS.darkgray,
    fontWeight: "500",
  },
  activeOwedTabText: {
    color: COLORS.white,
  },
  keyboardContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray2,
  },
});

export default CustomSplitEditor;

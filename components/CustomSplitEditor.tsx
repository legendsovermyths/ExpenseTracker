import React, { useState, useEffect } from "react";
import { View, StyleSheet, Text, TouchableOpacity } from "react-native";
import { Button, TextInput, DefaultTheme } from "react-native-paper";
import { COLORS, SIZES } from "../constants";
import { NumberField } from "./NumberField";
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
  const [tab, setTab] = useState<"paid" | "owed">("owed");
  const [owedTab, setOwedTab] = useState<"amount" | "percentage" | "parts">(
    "amount",
  );
  const [paidMe, setPaidMe] = useState<number>(total);
  const [paidFriend, setPaidFriend] = useState<number>(0);
  const [oweMe, setOweMe] = useState<number>(total / 2);
  const [oweFriend, setOweFriend] = useState<number>(total / 2);

  // For percentage split
  const [oweMePercent, setOweMePercent] = useState<number>(50);
  const [oweFriendPercent, setOweFriendPercent] = useState<number>(50);

  // For parts split
  const [oweMeParts, setOweMeParts] = useState<number>(1);
  const [oweFriendParts, setOweFriendParts] = useState<number>(1);

  const remainingPaid = total - (paidMe + paidFriend);
  const remainingOwed = total - (oweMe + oweFriend);

  // Update owed amounts when percentage changes
  useEffect(() => {
    if (owedTab === "percentage") {
      const totalPercent = oweMePercent + oweFriendPercent;
      if (totalPercent > 0) {
        setOweMe((oweMePercent / totalPercent) * total);
        setOweFriend((oweFriendPercent / totalPercent) * total);
      }
    }
  }, [oweMePercent, oweFriendPercent, owedTab, total]);

  // Update owed amounts when parts change
  useEffect(() => {
    if (owedTab === "parts") {
      const totalParts = oweMeParts + oweFriendParts;
      if (totalParts > 0) {
        setOweMe((oweMeParts / totalParts) * total);
        setOweFriend((oweFriendParts / totalParts) * total);
      }
    }
  }, [oweMeParts, oweFriendParts, owedTab, total]);

  const numInput = (
    value: number,
    setValue: React.Dispatch<React.SetStateAction<number>>,
    prefix: string = "",
    suffix: string = "",
  ) => (
    <NumberField
      value={value}
      onChange={setValue}
      prefix={prefix}
      suffix={suffix}
    />
  );

  const renderPaid = () => (
    <>
      <View style={styles.row}>
        <Text style={styles.label}>{meName} paid</Text>
        {numInput(paidMe, setPaidMe, "₹")}
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{friendName} paid</Text>
        {numInput(paidFriend, setPaidFriend, "₹")}
      </View>
      <Text style={styles.remaining}>
        Amount remaining: ₹{remainingPaid.toFixed(2)}
      </Text>
    </>
  );

  const renderOwedTabs = () => (
    <View style={styles.owedTabsContainer}>
      <TouchableOpacity
        style={[styles.owedTab, owedTab === "amount" && styles.activeOwedTab]}
        onPress={() => setOwedTab("amount")}
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
        onPress={() => setOwedTab("percentage")}
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
        onPress={() => setOwedTab("parts")}
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
            {numInput(oweMe, setOweMe, "₹")}
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{friendName}</Text>
            {numInput(oweFriend, setOweFriend, "₹")}
          </View>
          <Text style={styles.remaining}>
            Amount remaining: ₹{remainingOwed.toFixed(2)}
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
          <Text style={styles.remaining}>
            Total: {(oweMePercent + oweFriendPercent).toFixed(1)}%
          </Text>
          <Text style={styles.preview}>
            {meName}: ₹{oweMe.toFixed(2)} | {friendName}: ₹
            {oweFriend.toFixed(2)}
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
            {meName}: ₹{oweMe.toFixed(2)} | {friendName}: ₹
            {oweFriend.toFixed(2)}
          </Text>
        </>
      )}
    </>
  );

  const isValidSplit = () => {
    if (tab === "paid") {
      return Math.abs(remainingPaid) < 0.01; // Allow small floating point errors
    } else {
      return Math.abs(remainingOwed) < 0.01;
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
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
        onPress={() => onDone(paidMe, paidFriend, oweMe, oweFriend)}
        disabled={!isValidSplit()}
      >
        Done
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
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

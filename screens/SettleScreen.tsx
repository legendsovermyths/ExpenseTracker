import React, { useState } from "react";
import { View, StyleSheet, Text, TextInput } from "react-native";
import { Button, Provider } from "react-native-paper";
import { useNavigation, useRoute } from "@react-navigation/native";
import { COLORS, FONTS, SIZES } from "../constants";
import HeaderText from "../components/HeaderText";
import { requestSync } from "../services/BackgroundSync";
import { Appconstant } from "../types/entity/Appconstant";
import { useExpensifyStore } from "../store/store";
import { updateAppconstant } from "../services/Appconstants";
import { addSplitData, updateUserBalances } from "../services/Splits";
import { LedgerEntryRow } from "../types/entity/LedgerEntryRow";
import { LineItemRow } from "../types/entity/LineItemRow";
import uuid from "react-native-uuid";

interface Params {
  payerId: string;
  payerName: string;
  payeeId: string;
  payeeName: string;
  amountCents: number;
}

// Helper function to get current timestamp
function getNowTimestamp() {
  return new Date().toISOString();
}

const SettleScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { payerId, payerName, payeeId, payeeName, amountCents } =
    route.params as Params;

  const me = useExpensifyStore((state) => state.getUserId());
  const oldSplitSync: Appconstant = useExpensifyStore((state) =>
    state.getAppconstantByKey("lastSplitSync"),
  );
  const userBalancesById = useExpensifyStore((state) => state.userbalances);
  const setUserBalancesInUI = useExpensifyStore(
    (state) => state.setUserBalances,
  );
  const updateAppconstantInUI = useExpensifyStore((state) => state.updateAppconstant);

  const [amount, setAmount] = useState<string>((amountCents / 100).toString());
  const [error, setError] = useState<string | null>(null);

  const handleChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, "");
    setAmount(cleaned);
  };

  const handleSettle = async () => {
    const amtNum = Number(amount);
    if (!amtNum || amtNum <= 0) {
      setError("Enter a valid amount");
      return;
    }
    try {
      const cents = Math.round(amtNum * 100);
      
      // Create ledger entry with local UUID (local-first approach)
      let ledgerEntry: LedgerEntryRow = {
        id: uuid.v4(),
        created_at: getNowTimestamp(),
        updated_at: getNowTimestamp(),
        kind: "PAYMENT",
        is_deleted: false,
        description: "Settle Up",
        created_by: me,
        total_cents: cents,
      };

      const entryId = ledgerEntry.id as string;
      
      // Create line items for the settlement
      let lineItems: LineItemRow[] = [
        {
          entry_id: entryId,
          user_id: payeeId,
          amount_cents: -cents,
          paid_cents: 0,
          owed_cents: cents,
          updated_at: getNowTimestamp(),
        },
        {
          entry_id: entryId,
          user_id: payerId,
          amount_cents: cents,
          paid_cents: cents,
          owed_cents: 0,
          updated_at: getNowTimestamp(),
        },
      ];
      await addSplitData([ledgerEntry], lineItems);
      let userBalances = { ...userBalancesById };
      
      if (userBalances[payeeId]) {
        userBalances[payeeId] = {
          ...userBalances[payeeId],
          net_cents: userBalances[payeeId].net_cents + cents,
        };
      }
      
      if (userBalances[payerId]) {
        userBalances[payerId] = {
          ...userBalances[payerId],
          net_cents: userBalances[payerId].net_cents - cents,
        };
      }

      await updateUserBalances(Object.values(userBalances));
      setUserBalancesInUI(Object.values(userBalances));

      navigation.goBack();
    } catch (e: any) {
      setError(e.message || "Failed to settle");
    } 
  };

  return (
    <Provider>
      <View style={styles.wrapper}>
        <View>
          <HeaderText text="Record Payment" />
        </View>
        <View style={styles.directionRow}>
          <Text style={styles.personText}>{payerName}</Text>
          <Text style={styles.arrow}>➜</Text>
          <Text style={styles.personText}>{payeeName}</Text>
        </View>

        <TextInput
          style={styles.amountInput}
          keyboardType="numeric"
          value={amount}
          onChangeText={handleChange}
          placeholder="0"
          placeholderTextColor={COLORS.darkgray}
        />
        {error && <Text style={styles.error}>{error}</Text>}

        <Button
          mode="contained"
          buttonColor={COLORS.primary}
          textColor={COLORS.white}
          style={styles.settleButton}
          labelStyle={{ ...FONTS.h3 }}
          onPress={handleSettle}
        >
          Settle Up
        </Button>
      </View>
    </Provider>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingTop: (SIZES.padding * 5) / 2,
    paddingHorizontal: SIZES.padding,
  },
  directionRow: {
    marginTop: SIZES.padding * 4,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: SIZES.padding,
  },
  personText: { ...FONTS.h2, color: COLORS.primary },
  arrow: { ...FONTS.h2, color: COLORS.darkgray, marginHorizontal: 8 },
  amountInput: {
    alignSelf: "center",
    borderBottomWidth: 2,
    borderColor: COLORS.primary,
    width: "60%",
    textAlign: "center",
    ...FONTS.h1,
    color: COLORS.primary,
    marginVertical: SIZES.padding,
  },
  settleButton: {
    marginTop: SIZES.padding,
    marginHorizontal: SIZES.padding * 2,
    borderRadius: 30,
  },
  error: { color: COLORS.red, textAlign: "center", marginTop: 4 },
});

export default SettleScreen;

import React, { useState } from "react";
import { View, StyleSheet, TextInput } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { SPACE, TYPE } from "../constants";
import { Avatar, Form, Icon, Text, hapticRhythm } from "../components/ui";
import { markChanged, markTotalChanged } from "../services/Feedback";
import { requestSync } from "../services/BackgroundSync";
import { Appconstant } from "../types/entity/Appconstant";
import { useExpensifyStore } from "../store/store";
import { updateAppconstant } from "../services/Appconstants";
import { addSplitData, updateUserBalances } from "../services/Splits";
import { LedgerEntryRow } from "../types/entity/LedgerEntryRow";
import { LineItemRow } from "../types/entity/LineItemRow";
import uuid from "react-native-uuid";
import { useTheme } from "../contexts/ThemeContext";

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
  const { COLORS } = useTheme();
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
  const updateAppconstantInUI = useExpensifyStore(
    (state) => state.updateAppconstant,
  );

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

      const friendId = payerId === me ? payeeId : payerId;
      markChanged("split", [entryId], "added");
      markChanged("friend", [friendId], "edited");
      markTotalChanged(`friend:${friendId}`, payerId === me ? cents : -cents);
      hapticRhythm("saveLanded");
      navigation.goBack();
    } catch (e: any) {
      setError(e.message || "Failed to settle");
    }
  };

  const amtValid = Number(amount) > 0;

  return (
    <Form
      title="Record payment"
      onSave={handleSettle}
      saveLabel="Settle"
      canSave={amtValid}
    >
      <View style={styles.people}>
        <View style={styles.person}>
          <Avatar name={payerName} size={48} />
          <Text
            variant="headline"
            numberOfLines={1}
            align="center"
            style={styles.personName}
          >
            {payerName}
          </Text>
        </View>
        <Icon name="arrow-right" size="lg" color={COLORS.inkSubtle} />
        <View style={styles.person}>
          <Avatar name={payeeName} size={48} />
          <Text
            variant="headline"
            numberOfLines={1}
            align="center"
            style={styles.personName}
          >
            {payeeName}
          </Text>
        </View>
      </View>

      <View style={styles.amountRow}>
        <Text variant="amountLarge" tone="subtle">
          ₹
        </Text>
        <TextInput
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={handleChange}
          placeholder="0"
          placeholderTextColor={COLORS.inkSubtle}
          selectionColor={COLORS.accent}
          autoFocus
          style={[TYPE.display, styles.amountInput, { color: COLORS.ink }]}
          accessibilityLabel="Amount"
        />
      </View>
      {error && (
        <Text variant="callout" tone="up" align="center">
          {error}
        </Text>
      )}
    </Form>
  );
};

const styles = StyleSheet.create({
  people: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.lg,
    marginTop: SPACE.xl,
  },
  person: { alignItems: "center", flex: 1 },
  personName: { marginTop: SPACE.sm },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.xs,
    marginTop: SPACE.xxl,
    marginBottom: SPACE.sm,
  },
  amountInput: { padding: 0, margin: 0, minWidth: 80, textAlign: "center" },
});

export default SettleScreen;

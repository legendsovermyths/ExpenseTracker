import React, { useEffect, useState } from "react";
import { View, StyleSheet, Text, FlatList } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Provider, Button } from "react-native-paper";
import { COLORS, FONTS, SIZES } from "../constants";
import { fetchSplitSummary } from "../services/Splits";
import { useExpensifyStore } from "../store/store";
import { Transaction } from "../types/entity/Transaction";
import { TouchableOpacity } from "react-native-gesture-handler";

interface Params {
  entryId: string;
  friendId: string;
  friendName: string;
}
interface SummaryRow {
  name: string;
  paid: number;
  owes: number;
}

const SplitSummaryScreen: React.FC = () => {
  const navigation: any = useNavigation();
  const route = useRoute<any>();
  const { entryId, friendName, friendId } = route.params as Params;
  const transactionsById = useExpensifyStore((state) => state.transactions);
  const meId = useExpensifyStore((state) => state.getUserId());
  const [description, setDescription] = useState<string>("Split");
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [totalRs, setTotalRs] = useState<number>(0);
  const [transaction, setTransaction] = useState<Transaction>(null);
  useEffect(() => {
    (async () => {
      const res = await fetchSplitSummary(entryId);
      setDescription(res.description);
      const li = res.items as {
        user_id: string;
        amount_cents: number;
        paid_cents: number;
        owed_cents: number;
        transaction_id: number;
      }[];
      if (res.transaction_id) {
        setTransaction(transactionsById[res.transaction_id]);
      }
      const positives = li.reduce((a, b) => a + b.paid_cents, 0);
      setTotalRs(positives / 100);
      // This is a temporary fix to show username and my name
      const nameMap: Record<string, string> = {};
      nameMap[meId] = "You";
      nameMap[friendId] = friendName;
      const summary: SummaryRow[] = li.map((l) => ({
        name: nameMap[l.user_id] || "Unknown",
        paid: l.paid_cents / 100,
        owes: l.owed_cents / 100,
      }));
      setRows(summary);
    })();
  }, [entryId]);

  const fmt = (n: number) => `₹${n.toFixed(2)}`;

  return (
    <Provider>
      <View style={styles.wrapper}>
        <Text style={styles.heading}>{description}</Text>
        <Text style={styles.subheading}>Summary</Text>
        <Text style={styles.total}>{fmt(totalRs)}</Text>

        <FlatList
          data={rows}
          keyExtractor={(i) => i.name}
          renderItem={({ item }) => (
            <Text style={styles.sentence}>
              {`${item.name} paid ${fmt(item.paid)} and ${item.owes > 0 ? `owes ${fmt(item.owes)}` : `is owed ${fmt(item.paid)}`}`}
            </Text>
          )}
          contentContainerStyle={{
            paddingHorizontal: SIZES.padding,
            paddingBottom: SIZES.padding,
          }}
          ListFooterComponent={
            transaction? (
              <TouchableOpacity
                onPress={() => {
                  navigation.navigate("TransactionEdit", {
                    transaction: transaction,
                    mode: "edit",
                  });
                }}
              >
                <Text style={{ color: COLORS.gray }}>Go to Transaction</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  navigation.navigate("TransactionEdit", {
                    transaction: {
                      description: description,
                      amount: rows[0].owes,
                      date_time: new Date().toISOString(),
                    },
                    mode: "add",
                    entryId: entryId,
                  });
                }}
              >
                <Text style={{ color: COLORS.gray }}>Add to Trasanction</Text>
              </TouchableOpacity>
            )
          }
          ListFooterComponentStyle={{
            marginTop: SIZES.padding * 3,
            alignContent: "center",
            alignItems: "center",
          }}
        />
      </View>
    </Provider>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingTop: (5 * SIZES.padding) / 2,
  },
  editBtn: {
    position: "absolute",
    right: SIZES.padding,
    top: (7 * SIZES.padding) / 2,
  },
  heading: {
    ...FONTS.h1,
    color: COLORS.primary,
    textAlign: "center",
    marginTop: SIZES.padding,
  },
  subheading: {
    ...FONTS.body3,
    color: COLORS.darkgray,
    textAlign: "center",
  },
  total: {
    ...FONTS.h1,
    color: COLORS.primary,
    textAlign: "center",
    marginVertical: SIZES.padding,
  },
  sentence: {
    ...FONTS.body3,
    textAlign: "center",
    marginVertical: 6,
    color: COLORS.darkgray,
  },
});

export default SplitSummaryScreen;

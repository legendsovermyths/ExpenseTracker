import React, { useEffect, useState } from "react";
import { View, StyleSheet, Text, FlatList, Alert } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Provider, Button } from "react-native-paper";
import { COLORS, FONTS, SIZES } from "../constants";
import { useExpensifyStore } from "../store/store";
import { Transaction } from "../types/entity/Transaction";
import { deleteSplit, updateUserBalances, fetchSplitSummary } from "../services/Splits";

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
  const [transaction, setTransaction] = useState<Transaction | null>(null);

  const userBalancesById = useExpensifyStore((state) => state.userbalances);
  const setUserBalancesInUI = useExpensifyStore(
    (state) => state.setUserBalances,
  );

  useEffect(() => {
    (async () => {
      const res = await fetchSplitSummary(entryId);
      setDescription(res.description);

      const li = res.items as {
        user_id: string;
        amount_cents: number;
        paid_cents: number;
        owed_cents: number;
      }[];

      if (res.transaction_id) {
        // keys in Zustand map are stringified
        setTransaction(transactionsById[String(res.transaction_id)] ?? null);
      }

      const positives = li.reduce((a, b) => a + b.paid_cents, 0);
      setTotalRs(positives / 100);

      const nameMap: Record<string, string> = {
        [meId]: "You",
        [friendId]: friendName,
      };

      const summary: SummaryRow[] = li.map((l) => ({
        name: nameMap[l.user_id] || "Unknown",
        paid: l.paid_cents / 100,
        owes: l.owed_cents / 100,
      }));
      setRows(summary);
    })();
  }, [entryId]);

  const fmt = (n: number) => `₹${n.toFixed(2)}`;

  // my own owed amount (could be zero)
  const myRow = rows.find((r) => r.name === "You");
  const myOwes = myRow ? myRow.owes : 0;

  // ---------------------------
  // delete handler
  // ---------------------------
  const handleDelete = async () => {
    Alert.alert("Delete split", "Are you sure you want to delete this split?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            
            await deleteSplit(entryId);
            
            let userBalances = { ...userBalancesById };
            
            const splitSummary = await fetchSplitSummary(entryId);
            const lineItems = splitSummary.items as {
              user_id: string;
              amount_cents: number;
              paid_cents: number;
              owed_cents: number;
            }[];
            
            lineItems.forEach((item) => {
              if (item.user_id !== meId && userBalances[item.user_id]) {
                const originalBalanceChange = item.owed_cents - item.paid_cents;
                userBalances[item.user_id] = {
                  ...userBalances[item.user_id],
                  net_cents: userBalances[item.user_id].net_cents - originalBalanceChange,
                };
              }
            });
            
            await updateUserBalances(Object.values(userBalances));
            setUserBalancesInUI(Object.values(userBalances));
            
            navigation.goBack();
          } catch (e: any) {
            console.log("Delete split error:", e);
            // You might want to show an error message to the user here
          } finally {
          }
        },
      },
    ]);
  };

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
          ListFooterComponent={() => (
            <View style={styles.footerBtns}>
              {transaction ? (
                <Button
                  mode="outlined"
                  icon="pencil"
                  textColor={COLORS.primary}
                  style={[styles.button, styles.actionBtn]}
                  contentStyle={styles.btnContent}
                  labelStyle={FONTS.body3}
                  onPress={() =>
                    navigation.navigate("TransactionEdit", {
                      transaction,
                      mode: "edit",
                    })
                  }
                >
                  Go to Transaction
                </Button>
              ) : (
                <Button
                  mode="outlined"
                  textColor={COLORS.primary}
                  icon="plus"
                  style={[styles.button, styles.actionBtn]}
                  contentStyle={styles.btnContent}
                  labelStyle={FONTS.body3}
                  onPress={() =>
                    navigation.navigate("TransactionEdit", {
                      transaction: {
                        description,
                        amount: myOwes,
                        date_time: new Date().toISOString(),
                      },
                      mode: "add",
                      entryId,
                    })
                  }
                >
                  Add to Transaction
                </Button>
              )}

              <Button
                mode="outlined"
                icon="delete-outline"
                textColor={COLORS.red2}
                style={[styles.button, styles.deleteBtn]}
                contentStyle={styles.btnContent}
                labelStyle={FONTS.body3}
                onPress={handleDelete}
              >
                Delete Split
              </Button>
            </View>
          )}
          ListFooterComponentStyle={{
            marginTop: SIZES.padding * 3,
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
  footerBtns: {
    alignItems: "center",
    display: "flex",
  },
  actionBtn: {
    marginBottom: 20,
    width: 280,
    color: COLORS.white,
  },
  deleteBtn: {
    marginTop: 0,
    width: 280,
  },
  button: {
    alignSelf: "center",
  },
  btnContent: {
    height: 48,
    color: COLORS.white,
  },
});

export default SplitSummaryScreen;

import React, { useEffect, useState } from "react";
import { View, StyleSheet, Text, FlatList } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Provider, Button } from "react-native-paper";
import HeaderNavigator from "../components/HeaderNavigator";
import { COLORS, FONTS, SIZES } from "../constants";
import { supabase } from "../services/Supabase";
import { fetchSplitSummary } from "../services/Splits";
import { useExpensifyStore } from "../store/store";

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
  const meId = useExpensifyStore((state) => state.getUserId());
  const [description, setDescription] = useState<string>("Split");
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [totalRs, setTotalRs] = useState<number>(0);

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

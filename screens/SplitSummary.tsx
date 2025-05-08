import React, { useEffect, useState } from "react";
import { View, StyleSheet, Text, FlatList } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Provider, Button } from "react-native-paper";
import HeaderNavigator from "../components/HeaderNavigator";
import { COLORS, FONTS, SIZES } from "../constants";
import { supabase } from "../services/Supabase";

interface Params {
  entryId: string;
}
interface SummaryRow {
  name: string;
  paid: number;
  owes: number;
}

const SplitSummaryScreen: React.FC = () => {
  const navigation: any = useNavigation();
  const route = useRoute<any>();
  const { entryId } = route.params as Params;

  const [description, setDescription] = useState<string>("Split");
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [totalRs, setTotalRs] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const { data: entry } = await supabase
        .from("ledger_entry")
        .select(
          "description, line_item(user_id,amount_cents,paid_cents,owed_cents)",
        )
        .eq("id", entryId)
        .single();
      if (!entry) return;
      setDescription(entry.description || "Split");

      const li = entry.line_item as {
        user_id: string;
        amount_cents: number;
        paid_cents: number;
        owed_cents: number;
      }[];
      const positives = li.reduce((a, b) => a + b.paid_cents, 0);
      setTotalRs(positives / 100);

      const userIds = li.map((l) => l.user_id);
      const { data: names } = await supabase
        .from("profiles")
        .select("id,full_name")
        .in("id", userIds);
      const nameMap: Record<string, string> = {};
      names?.forEach((n: any) => (nameMap[n.id] = n.full_name));

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
        <Button
          mode="text"
          textColor={COLORS.primary}
          style={styles.editBtn}
          onPress={() => navigation.navigate("EditSplitScreen", { entryId })}
        >
          Edit
        </Button>

        {/* heading */}
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

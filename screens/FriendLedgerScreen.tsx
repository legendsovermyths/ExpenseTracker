import React, { useCallback, useState } from "react";
import { View, FlatList, StyleSheet, ActivityIndicator, Text } from "react-native";
import { createClient } from "@supabase/supabase-js";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import { Button, Provider } from "react-native-paper";
import { COLORS, FONTS, SIZES } from "../constants";
import HeaderNavigator from "../components/HeaderNavigator";
import HeaderText from "../components/HeaderText";
import { supabase } from "../services/Supabase";

interface LedgerItemRow {
  entry_id: string;
  description: string | null;
  created_at: string;
  delta_cents: number; // positive => they owe me; negative => I owe
}

const LedgerCard: React.FC<{ item: LedgerItemRow }> = ({ item }) => {
  const positive = item.delta_cents > 0;
  const amountRs = Math.abs(item.delta_cents) / 100;
  return (
    <View style={styles.cardRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.descText}>{item.description || "(No description)"}</Text>
        <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text
          style={{
            ...FONTS.body4,
            color: positive ? COLORS.darkgreen : COLORS.red2,
            marginBottom: 2,
          }}
        >
          {positive ? "You lent" : "You borrowed"}
        </Text>
        <Text
          style={{
            ...FONTS.body2,
            color: positive ? COLORS.darkgreen : COLORS.red2,
          }}
        >
          ₹{amountRs.toFixed(2)}
        </Text>
      </View>
    </View>
  );
};

const FriendLedgerScreen: React.FC = () => {
  const route = useRoute<any>();
  const { friendId, friendName } = route.params as { friendId: string; friendName: string };
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LedgerItemRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchLedger = async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr || !user) throw authErr || new Error("Not authenticated");
      const me = user.id;

      // 1. pull all line_item rows involving me OR friend
      const { data: li, error: liErr } = await supabase
        .from("line_item")
        .select("entry_id,user_id,amount_cents,ledger_entry(description,created_at)")
        .in("user_id", [me, friendId]);
      if (liErr) throw liErr;
      if (!li) return;

      // 2. group by entry_id and keep only entries where both users present
      const map = new Map<string, { desc: string | null; created_at: string; delta: number; seen_me: boolean; seen_friend: boolean }>();
      li.forEach((row: any) => {
        const id = row.entry_id;
        if (!map.has(id)) {
          map.set(id, {
            desc: row.ledger_entry?.description || null,
            created_at: row.ledger_entry?.created_at,
            delta: 0,
            seen_me: true,
            seen_friend: true,
          });
        }
        console.log(map);
        const obj = map.get(id)!;
        if (row.user_id == me) {
          obj.delta += -row.amount_cents; // negate: my positive means they owe me
          obj.seen_me = true;
        } else {
          obj.delta += row.amount_cents;
          obj.seen_friend = true;
        }
      });
      const finalRows: LedgerItemRow[] = [];
      map.forEach((v, k) => {
        if (v.seen_me && v.seen_friend) {
          finalRows.push({
            entry_id: k,
            description: v.desc,
            created_at: v.created_at,
            delta_cents: v.delta,
          });
        }
      });
      finalRows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRows(finalRows);
    } catch (e: any) {
      setError(e.message || "Failed to fetch ledger");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchLedger();
    }, []),
  );

  if (loading) {
    return (
      <View style={styles.centered}><ActivityIndicator color={COLORS.primary} /></View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: COLORS.red }}>{error}</Text>
        <Button mode="outlined" onPress={fetchLedger}>Retry</Button>
      </View>
    );
  }

  return (
    <Provider>
      <View style={styles.screenWrapper}>
        <View style={styles.headerBar}>
          <HeaderText text={friendName} />
        </View>
        <FlatList
          data={rows}
          keyExtractor={(item) => item.entry_id}
          renderItem={({ item }) => <LedgerCard item={item} />}
          contentContainerStyle={{ paddingHorizontal: SIZES.padding, paddingBottom: SIZES.padding }}
          ListEmptyComponent={() => (
            <Text style={{ textAlign: "center", marginTop: 20 }}>No shared transactions yet.</Text>
          )}
        />
      </View>
    </Provider>
  );
};

// ---------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------
const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingTop: SIZES.padding,
  },
  headerBar: {
    paddingHorizontal: SIZES.padding,
    paddingBottom: SIZES.padding / 2,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SIZES.padding / 4,
  },
  descText: {
    ...FONTS.body3,
    color: COLORS.primary,
  },
  dateText: {
    ...FONTS.caption,
    color: COLORS.darkgray,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.white,
  },
});

export default FriendLedgerScreen;

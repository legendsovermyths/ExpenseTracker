import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { COLORS, FONTS, SIZES } from "../constants";
import HeaderText from "../components/HeaderText";
import { Icon } from "react-native-elements";
import { Button, Provider } from "react-native-paper";
import { supabase } from "../services/Supabase";

interface BalanceRow {
  friend_id: string;
  friend_name: string;
  net_cents: number;
}

const BalanceCard: React.FC<{ row: BalanceRow }> = ({ row }) => {
  const positive = row.net_cents > 0;
  const amountRs = Math.abs(row.net_cents) / 100;
  const label = positive ? "OWES YOU" : "YOU OWE";
  const labelColor = positive ? COLORS.darkgreen : COLORS.red2;
  const navigation: any = useNavigation();
  return (
    <TouchableOpacity
      onPress={() =>
        navigation.navigate("FriendLedgerScreen", {
          friendId: row.friend_id,
          friendName: row.friend_name,
          netCents: row.net_cents,
        })
      }
    >
      <View style={styles.cardContainer}>
        <View style={styles.iconContainer}>
          <Icon name="user" type="feather" size={22} color={COLORS.lightBlue} />
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.nameText}>{row.friend_name}</Text>
        </View>
        <View style={styles.amountContainer}>
          <Text style={[styles.labelText, { color: labelColor }]}>{label}</Text>
          <Text style={[styles.amountText, { color: labelColor }]}>
            ₹{amountRs.toFixed(2)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const BalancesScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr || !user) throw authErr || new Error("Not authenticated");
      const me = user.id;

      const { data: bal, error: balErr } = await supabase
        .from("balance_pair_me")
        .select("user_lo,user_hi,net_cents");
      if (balErr) throw balErr;
      if (!bal) return;

      const friendIds = bal.map((r) =>
        r.user_lo === me ? r.user_hi : r.user_lo,
      );

      const { data: friends, error: frErr } = await supabase
        .from("profiles")
        .select("id,full_name")
        .in("id", friendIds);
      if (frErr) throw frErr;
      const nameMap: Record<string, string> = {};
      friends?.forEach((f) => (nameMap[f.id] = f.full_name));

      const combined: BalanceRow[] = bal.map((r) => {
        const friendId = r.user_lo === me ? r.user_hi : r.user_lo;
        const signed = r.user_lo === me ? r.net_cents : -r.net_cents;
        return {
          friend_id: friendId,
          friend_name: nameMap[friendId] || "Unknown",
          net_cents: signed,
        };
      });
      combined.sort((a, b) => Math.abs(b.net_cents) - Math.abs(a.net_cents));
      setRows(combined);
    } catch (e: any) {
      setError(e.message || "Failed to fetch balances");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchBalances();
    }, []),
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: COLORS.red }}>{error}</Text>
        <Button mode="outlined" onPress={fetchBalances}>
          Retry
        </Button>
      </View>
    );
  }

  return (
    <Provider>
      <View style={styles.screenWrapper}>
        <View style={styles.headerContainer}>
          <HeaderText text="Balances" />
        </View>
        <FlatList
          data={rows}
          keyExtractor={(item) => item.friend_id}
          renderItem={({ item }) => <BalanceCard row={item} />}
          contentContainerStyle={{ paddingHorizontal: SIZES.padding }}
          ListEmptyComponent={() => (
            <Text style={{ textAlign: "center", marginTop: 20 }}>
              You're all settled up! 🎉
            </Text>
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
    paddingTop: 2 * SIZES.padding,
  },
  headerContainer: {
    paddingHorizontal: SIZES.padding,
    paddingBottom: SIZES.padding / 2,
  },
  cardContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SIZES.padding / 4,
  },
  iconContainer: {
    backgroundColor: COLORS.lightGray,
    height: 50,
    width: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  infoContainer: {
    flex: 1,
    marginLeft: SIZES.padding / 3,
  },
  nameText: {
    ...FONTS.h3,
    color: COLORS.primary,
  },
  amountContainer: {
    marginLeft: SIZES.padding,
    alignItems: "flex-end",
  },
  labelText: {
    ...FONTS.body4,
    fontWeight: "500",
  },
  amountText: {
    ...FONTS.c1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.white,
  },
});

export default BalancesScreen;

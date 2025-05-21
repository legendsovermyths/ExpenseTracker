import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { COLORS, FONTS, SIZES } from "../constants";
import HeaderText from "../components/HeaderText";
import { Icon } from "react-native-elements";
import { Button, Provider } from "react-native-paper";
import { supabase } from "../services/Supabase";
import { useExpensifyStore } from "../store/store";
import { UserBalance } from "../types/entity/UserBalance";
import { updateUserBalances } from "../services/Splits";
import CustomFAB from "../components/CustomFAB";

const BalanceCard: React.FC<{ row: UserBalance }> = ({ row }) => {
  const positive = row.net_cents > 0;
  const isSettled = row.net_cents == 0;
  const amountRs = Math.abs(row.net_cents) / 100;
  const label = positive ? "OWES YOU" : "YOU OWE";
  const labelColor = isSettled
    ? COLORS.darkgray
    : positive
      ? COLORS.darkgreen
      : COLORS.red2;
  const navigation: any = useNavigation();
  return (
    <TouchableOpacity
      onLongPress={() => {
        navigation.navigate("SplitInputScreen", {
          userId: row.id,
          userName: row.name,
        });
      }}
      onPress={() =>
        navigation.navigate("FriendLedgerScreen", {
          friendId: row.id,
          friendName: row.name,
          netCents: row.net_cents,
        })
      }
    >
      <View style={styles.cardContainer}>
        <View style={styles.iconContainer}>
          <Icon name="user" type="feather" size={22} color={COLORS.lightBlue} />
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.nameText}>{row.name}</Text>
        </View>
        {isSettled ? (
          <Text
            style={[
              styles.amountText,
              { color: labelColor, fontSize: 16, marginTop: 5.5 },
            ]}
          >
            {"All Settled!"}
          </Text>
        ) : (
          <View style={styles.amountContainer}>
            <Text style={[styles.labelText, { color: labelColor }]}>
              {label}
            </Text>
            <Text style={[styles.amountText, { color: labelColor }]}>
              ₹{amountRs.toFixed(2)}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const BalancesScreen: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const userBalancesById = useExpensifyStore((state) => state.userbalances);
  const rows = Object.values(userBalancesById);
  const setUserBalancesInUI = useExpensifyStore(
    (state) => state.setUserBalances,
  );

  const fetchBalances = async () => {
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
      if (balErr) {
        return;
      }
      if (!bal) return;
      const friendIds = bal.map((r) =>
        r.user_lo === me ? r.user_hi : r.user_lo,
      );

      const { data: friends, error: frErr } = await supabase
        .from("profiles")
        .select("id,full_name")
        .in("id", friendIds);
      if (frErr) {
        return;
      }
      const nameMap: Record<string, string> = {};
      friends?.forEach((f) => (nameMap[f.id] = f.full_name));

      const combined: UserBalance[] = bal.map((r) => {
        const friendId = r.user_lo === me ? r.user_hi : r.user_lo;
        const signed = r.user_lo === me ? r.net_cents : -r.net_cents;
        return {
          id: friendId,
          name: nameMap[friendId] || "Unknown",
          net_cents: signed,
        };
      });
      await updateUserBalances(combined);
      setUserBalancesInUI(combined);
    } catch (e: any) {
    } finally {
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchBalances();
    }, []),
  );

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
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <BalanceCard row={item} />}
          contentContainerStyle={{ paddingHorizontal: SIZES.padding }}
          ListEmptyComponent={() => (
            <Text style={{ textAlign: "center", marginTop: 20 }}>
              You're all settled up! 🎉
            </Text>
          )}
        />
        <CustomFAB />
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

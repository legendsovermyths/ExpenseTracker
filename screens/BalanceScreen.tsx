import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { FONTS, SIZES } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";
import HeaderText from "../components/HeaderText";
import { Icon } from "react-native-elements";
import { Button, Provider } from "react-native-paper";
import { supabase } from "../services/Supabase";
import { useExpensifyStore } from "../store/store";
import { UserBalance } from "../types/entity/UserBalance";
import { updateUserBalances } from "../services/Splits";
import { formatAmountWithCommas } from "../services/Utils";
import { Avatar } from "../components/primitives";
import CustomFAB from "../components/CustomFAB";
import { requestSync } from "../services/BackgroundSync";
import { Appconstant } from "../types/entity/Appconstant";

const BalanceCard: React.FC<{ row: UserBalance }> = ({ row }) => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const positive = row.net_cents > 0;
  const isSettled = row.net_cents == 0;
  const amountRs = Math.abs(row.net_cents) / 100;
  const label = positive ? "OWES YOU" : "YOU OWE";
  const labelColor = isSettled
    ? COLORS.neutral
    : positive
      ? COLORS.deltaDown
      : COLORS.deltaUp;
  const navigation: any = useNavigation();
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onLongPress={() => {
        navigation.navigate("SplitInputScreen", {
          userId: row.id,
          userName: row.name,
        });
      }}
      delayLongPress={250}
      onPress={() =>
        navigation.navigate("FriendLedgerScreen", {
          friendId: row.id,
          friendName: row.name,
          netCents: row.net_cents,
        })
      }
    >
      <View style={styles.cardContainer}>
        <Avatar name={row.name} size={46} />
        <View style={styles.infoContainer}>
          <Text style={styles.nameText} numberOfLines={1}>{row.name}</Text>
          {isSettled && <Text style={styles.settledSub}>All settled up</Text>}
        </View>
        {isSettled ? (
          <Icon name="check-circle-outline" type="material-community" size={22} color={COLORS.neutral} />
        ) : (
          <View style={styles.amountContainer}>
            <Text style={[styles.labelText, { color: labelColor }]}>
              {label}
            </Text>
            <Text style={[styles.amountText, { color: labelColor }]}>
              ₹{formatAmountWithCommas(amountRs, true)}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const BalancesScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [error, setError] = useState<string | null>(null);
  const userBalancesById = useExpensifyStore((state) => state.userbalances);
  const [query, setQuery] = useState("");
  const allRows = Object.values(userBalancesById);
  const filteredRows = query.trim()
    ? allRows.filter((r) =>
        r.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : allRows;
  // Highest "owes you" first, "you owe" last (settled in the middle).
  const rows = [...filteredRows].sort((a, b) => b.net_cents - a.net_cents);

  const oldSplitSync: Appconstant = useExpensifyStore((state) =>
    state.getAppconstantByKey("lastSplitSync"),
  );
  const [refreshing, setRefreshing] = useState<boolean>(false);
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
      handleRefresh(true);
    }, []),
  );
  const handleRefresh = async (silent: boolean = false) => {
    if (!silent) setRefreshing(true);
    await requestSync(oldSplitSync.value);
    await fetchBalances();
    if (!silent) setRefreshing(false);
  };
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
        {allRows.length > 0 && (
          <View style={styles.searchBox}>
            <Icon name="magnify" type="material-community" size={18} color={COLORS.inkMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search people"
              placeholderTextColor={COLORS.inkSubtle}
              value={query}
              onChangeText={setQuery}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")}>
                <Icon name="close" type="material-community" size={18} color={COLORS.inkMuted} />
              </TouchableOpacity>
            )}
          </View>
        )}
        <FlatList
          onRefresh={() => handleRefresh()}
          refreshing={refreshing}
          data={rows}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <BalanceCard row={item} />}
          contentContainerStyle={{ paddingHorizontal: SIZES.padding }}
          ListEmptyComponent={() => (
            <Text style={styles.emptyText}>
              {query.trim() ? "No people found" : "You're all settled up! 🎉"}
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
const createStyles = (COLORS: ColorPalette) => StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingTop: 2 * SIZES.padding,
  },
  headerContainer: {
    paddingHorizontal: SIZES.padding,
    paddingBottom: SIZES.padding / 2,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: SIZES.base,
    backgroundColor: COLORS.surface1,
    borderRadius: 10,
    paddingHorizontal: SIZES.base + 2,
    marginHorizontal: SIZES.padding,
    marginBottom: SIZES.base + 2,
  },
  searchInput: {
    flex: 1,
    ...FONTS.body3,
    color: COLORS.ink,
    paddingVertical: SIZES.base,
  },
  cardContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SIZES.base + 2,
    gap: 12,
  },
  infoContainer: {
    flex: 1,
  },
  nameText: {
    ...FONTS.h3,
    color: COLORS.ink,
  },
  settledSub: {
    ...FONTS.caption,
    color: COLORS.inkMuted,
    marginTop: 2,
  },
  amountContainer: {
    marginLeft: SIZES.padding,
    alignItems: "flex-end",
  },
  labelText: {
    ...FONTS.caption,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  amountText: {
    ...FONTS.amountInline,
    fontSize: 17,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 24,
    ...FONTS.body3,
    color: COLORS.inkMuted,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.white,
  },
});

export default BalancesScreen;

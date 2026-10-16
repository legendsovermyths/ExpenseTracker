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
import { FONTS, SIZES, FONT } from "../constants";
import { useTheme, ThemedPaperProvider } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";
import HeaderText from "../components/HeaderText";
import { Icon } from "react-native-elements";
import { Button } from "react-native-paper";
import { useExpensifyStore } from "../store/store";
import { UserBalance } from "../types/entity/UserBalance";
import { updateUserBalances, fetchUserBalances } from "../services/Splits";
import { updateAppconstant } from "../services/Appconstants";
import { formatAmountWithCommas } from "../services/Utils";
import { Avatar } from "../components/primitives";
import GlyphPlate from "../components/primitives/GlyphPlate";
import CustomFAB from "../components/CustomFAB";
import { requestSync, requestFundSync } from "../services/BackgroundSync";
import { Appconstant } from "../types/entity/Appconstant";
import { Fund } from "../types/entity/Fund";
import { fetchFunds } from "../services/Funds";
import { fetchGroups } from "../services/Groups";
import { GroupSummary } from "../types/entity/Group";

// Same char-code hash `Avatar`'s `avatarColor` uses, indexed into the
// ordinal palette instead — keeps fund-icon tinting stable per fund without
// storing a color on the entity (nothing in this app stores per-entity color).
const ordinalColorForId = (id: string, palette: readonly string[]): string => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
};

const FundCard: React.FC<{ fund: Fund }> = ({ fund }) => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const navigation: any = useNavigation();
  const color = ordinalColorForId(fund.id, COLORS.ordinal);
  const hasTarget = fund.target_cents != null;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => navigation.navigate("FundDetailScreen", { fundId: fund.id })}
      onLongPress={() => navigation.navigate("CreateFundScreen", { fundId: fund.id })}
      delayLongPress={250}
    >
      <View style={styles.cardContainer}>
        <GlyphPlate
          name={fund.icon_name || "piggy-bank-outline"}
          type={fund.icon_type || "material-community"}
          color={color}
          size={46}
          radius={14}
        />
        <View style={styles.infoContainer}>
          <Text style={styles.nameText} numberOfLines={1}>{fund.name}</Text>
          <Text style={styles.settledSub}>
            {hasTarget ? "Goal set" : "Open-ended"}
            {fund.is_shared ? " · Shared" : ""}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const GroupCard: React.FC<{ summary: GroupSummary; meId: string }> = ({ summary, meId }) => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const navigation: any = useNavigation();
  const { group, members, my_net_cents } = summary;
  const color = ordinalColorForId(group.id, COLORS.ordinal);
  const isSettled = Math.abs(my_net_cents) <= 1;
  const positive = my_net_cents > 0;
  const labelColor = isSettled ? COLORS.neutral : positive ? COLORS.deltaDown : COLORS.deltaUp;
  const others = members
    .filter((m) => m.user_id !== meId)
    .map((m) => (m.user_name || "").split(" ")[0])
    .filter(Boolean);
  const memberLine =
    others.length <= 3
      ? ["You", ...others].join(", ")
      : `You, ${others.slice(0, 2).join(", ")} +${others.length - 2}`;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => navigation.navigate("GroupDetail", { grpId: group.id })}
      onLongPress={() => navigation.navigate("AddGroupExpense", { grpId: group.id })}
      delayLongPress={250}
    >
      <View style={styles.cardContainer}>
        <GlyphPlate name="account-group" type="material-community" color={color} size={46} radius={14} />
        <View style={styles.infoContainer}>
          <Text style={styles.nameText} numberOfLines={1}>{group.name}</Text>
          <Text style={styles.settledSub} numberOfLines={1}>{memberLine}</Text>
        </View>
        {isSettled ? (
          <Icon name="check-circle-outline" type="material-community" size={22} color={COLORS.neutral} />
        ) : (
          <View style={styles.amountContainer}>
            <Text style={[styles.labelText, { color: labelColor }]}>
              {positive ? "YOU'RE OWED" : "YOU OWE"}
            </Text>
            <Text style={[styles.amountText, { color: labelColor }]}>
              ₹{formatAmountWithCommas(Math.abs(my_net_cents) / 100, true)}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

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
  const navigation: any = useNavigation();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [error, setError] = useState<string | null>(null);
  const [activeSegment, setActiveSegment] = useState<"friends" | "groups" | "funds">("friends");
  const userBalancesById = useExpensifyStore((state) => state.userbalances);
  const fundsById = useExpensifyStore((state) => state.funds);
  const [query, setQuery] = useState("");
  const allRows = Object.values(userBalancesById);
  const filteredRows = query.trim()
    ? allRows.filter((r) =>
        r.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : allRows;
  // Highest "owes you" first, "you owe" last (settled in the middle).
  const rows = [...filteredRows].sort((a, b) => b.net_cents - a.net_cents);

  const allFunds = Object.values(fundsById);
  const filteredFunds = query.trim()
    ? allFunds.filter((f) => f.name.toLowerCase().includes(query.trim().toLowerCase()))
    : allFunds;
  const funds = [...filteredFunds].sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  const groupsById = useExpensifyStore((state) => state.groups);
  const allGroups = Object.values(groupsById);
  const groups = (query.trim()
    ? allGroups.filter((g) => g.group.name.toLowerCase().includes(query.trim().toLowerCase()))
    : allGroups
  ).sort((a, b) =>
    (b.last_activity_at ?? b.group.created_at).localeCompare(a.last_activity_at ?? a.group.created_at),
  );

  const oldSplitSync: Appconstant = useExpensifyStore((state) =>
    state.getAppconstantByKey("lastSplitSync"),
  );
  const oldFundSync: Appconstant = useExpensifyStore((state) =>
    state.getAppconstantByKey("lastFundSync"),
  );
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const setUserBalancesInUI = useExpensifyStore(
    (state) => state.setUserBalances,
  );
  const setFundsInUI = useExpensifyStore((state) => state.setFunds);
  const setGroupsInUI = useExpensifyStore((state) => state.setGroups);
  const userId = useExpensifyStore((state) => state.getUserId());

  const fetchBalances = async () => {
    setError(null);
    try {
      const combined = await fetchUserBalances();
      await updateUserBalances(combined);
      setUserBalancesInUI(combined);
    } catch (e: any) {
      console.warn("fetchBalances failed:", e?.message ?? e);
    }
  };

  const refreshFunds = async () => {
    if (!userId) return;
    try {
      const newest = await requestFundSync(oldFundSync?.value);
      if (oldFundSync) await updateAppconstant({ ...oldFundSync, value: newest });
    } catch (e: any) {
      console.warn("requestFundSync failed:", e?.message ?? e);
    }
    const fetched = await fetchFunds(userId);
    setFundsInUI(fetched);
  };

  const refreshGroups = async () => {
    if (!userId) return;
    try {
      setGroupsInUI(await fetchGroups(userId));
    } catch (e: any) {
      console.warn("fetchGroups failed:", e?.message ?? e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      // Local data first so the list paints immediately, then sync.
      refreshGroups();
      handleRefresh(true);
    }, []),
  );
  const handleRefresh = async (silent: boolean = false) => {
    if (!silent) setRefreshing(true);
    await Promise.all([
      requestSync(oldSplitSync.value)
        .then(() => Promise.all([fetchBalances(), refreshGroups()]))
        .catch((e) => console.warn("requestSync failed:", e?.message ?? e)),
      refreshFunds(),
    ]);
    if (!silent) setRefreshing(false);
  };
  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: COLORS.deltaUp }}>{error}</Text>
        <Button mode="outlined" onPress={fetchBalances}>
          Retry
        </Button>
      </View>
    );
  }

  return (
    <ThemedPaperProvider>
      <View style={styles.screenWrapper}>
        <View style={styles.headerContainer}>
          <HeaderText text="Balances" />
        </View>
        <View style={styles.segmentRow}>
          <TouchableOpacity
            style={[styles.segmentPill, activeSegment === "friends" && styles.segmentPillActive]}
            onPress={() => setActiveSegment("friends")}
          >
            <Text style={[styles.segmentLabel, activeSegment === "friends" && styles.segmentLabelActive]}>
              Friends
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentPill, activeSegment === "groups" && styles.segmentPillActive]}
            onPress={() => setActiveSegment("groups")}
          >
            <Text style={[styles.segmentLabel, activeSegment === "groups" && styles.segmentLabelActive]}>
              Groups
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentPill, activeSegment === "funds" && styles.segmentPillActive]}
            onPress={() => setActiveSegment("funds")}
          >
            <Text style={[styles.segmentLabel, activeSegment === "funds" && styles.segmentLabelActive]}>
              Funds
            </Text>
          </TouchableOpacity>
        </View>
        {(activeSegment === "friends"
          ? allRows.length > 0
          : activeSegment === "groups"
            ? allGroups.length > 0
            : allFunds.length > 0) && (
          <View style={styles.searchBox}>
            <Icon name="magnify" type="material-community" size={18} color={COLORS.inkMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder={
                activeSegment === "friends"
                  ? "Search people"
                  : activeSegment === "groups"
                    ? "Search groups"
                    : "Search funds"
              }
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
        {activeSegment === "friends" ? (
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
        ) : activeSegment === "groups" ? (
          <FlatList
            onRefresh={() => handleRefresh()}
            refreshing={refreshing}
            data={groups}
            keyExtractor={(item) => item.group.id}
            renderItem={({ item }) => <GroupCard summary={item} meId={userId} />}
            contentContainerStyle={{ paddingHorizontal: SIZES.padding }}
            ListEmptyComponent={() =>
              query.trim() ? (
                <Text style={styles.emptyText}>No groups found</Text>
              ) : (
                <TouchableOpacity onPress={() => navigation.navigate("CreateGroupScreen")}>
                  <Text style={styles.emptyText}>No groups yet — tap to create one</Text>
                </TouchableOpacity>
              )
            }
          />
        ) : (
          <FlatList
            onRefresh={() => handleRefresh()}
            refreshing={refreshing}
            data={funds}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <FundCard fund={item} />}
            contentContainerStyle={{ paddingHorizontal: SIZES.padding }}
            ListEmptyComponent={() => (
              <Text style={styles.emptyText}>
                {query.trim() ? "No funds found" : "No funds yet"}
              </Text>
            )}
          />
        )}
        <CustomFAB />
      </View>
    </ThemedPaperProvider>
  );
};

// ---------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------
const createStyles = (COLORS: ColorPalette) => StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: COLORS.paper,
    paddingTop: 2 * SIZES.padding,
  },
  headerContainer: {
    paddingHorizontal: SIZES.padding,
    paddingBottom: SIZES.padding / 2,
  },
  // A single muted track with a small floating capsule for the active
  // segment — same visual language as a native iOS segmented control,
  // instead of a bold color-filled toggle.
  segmentRow: {
    flexDirection: "row",
    backgroundColor: COLORS.surface1,
    borderRadius: 10,
    padding: 3,
    marginHorizontal: SIZES.padding,
    marginBottom: SIZES.base + 6,
  },
  segmentPill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: SIZES.base - 2,
    borderRadius: 8,
  },
  segmentPillActive: {
    backgroundColor: COLORS.paper,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentLabel: {
    ...FONTS.bodyS,
    fontFamily: FONT.medium,
    color: COLORS.inkMuted,
  },
  segmentLabelActive: {
    fontFamily: FONT.bold,
    color: COLORS.ink,
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
    backgroundColor: COLORS.paper,
  },
});

export default BalancesScreen;

import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { SPACE } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";
import { useExpensifyStore } from "../store/store";
import { UserBalance } from "../types/entity/UserBalance";
import { updateUserBalances, fetchUserBalances } from "../services/Splits";
import { updateAppconstant } from "../services/Appconstants";
import CustomFAB from "../components/CustomFAB";
import { requestSync, requestFundSync } from "../services/BackgroundSync";
import { Appconstant } from "../types/entity/Appconstant";
import { Fund } from "../types/entity/Fund";
import { fetchFunds } from "../services/Funds";
import { fetchGroups } from "../services/Groups";
import { GroupSummary } from "../types/entity/Group";
import {
  Amount,
  Avatar,
  EmptyState,
  GlyphPlate,
  HeaderIconButton,
  Icon,
  LargeTitle,
  ListRow,
  Pressable,
  SearchField,
  SegmentedControl,
  Text,
  Tone,
} from "../components/ui";
import { matchesSearch } from "../services/Search";

type Segment = "friends" | "groups" | "funds";

// Same char-code hash `Avatar`'s `avatarColor` uses, indexed into the
// ordinal palette instead — keeps fund-icon tinting stable per fund without
// storing a color on the entity (nothing in this app stores per-entity color).
const ordinalColorForId = (id: string, palette: readonly string[]): string => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
};

/** "owes you ₹120" stacked on the right of a row. */
const NetAmount: React.FC<{ label: string; cents: number; tone: Tone }> = ({ label, cents, tone }) => (
  <View style={styles.net}>
    <Text variant="caption" tone={tone}>
      {label}
    </Text>
    <Amount cents={Math.abs(cents)} tone={tone} />
  </View>
);

const Settled: React.FC = () => {
  const { COLORS } = useTheme();
  return <Icon name="check-circle-outline" size="md" color={COLORS.neutral} />;
};

/** Gutter + hairline under every row but the last. */
const RowFrame: React.FC<{ last: boolean; COLORS: ColorPalette; children: React.ReactNode }> = ({
  last,
  COLORS,
  children,
}) => (
  <View style={styles.gutter}>
    <View style={!last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.hairline }}>
      {children}
    </View>
  </View>
);

/** Row press target; keeps the original 250ms long-press delay. */
const Tap: React.FC<{ onPress: () => void; onLongPress: () => void; children: React.ReactNode }> = ({
  onPress,
  onLongPress,
  children,
}) => (
  <Pressable scale={false} onPress={onPress} onLongPress={onLongPress} delayLongPress={250}>
    {children}
  </Pressable>
);

const FundRow: React.FC<{ fund: Fund }> = ({ fund }) => {
  const { COLORS } = useTheme();
  const navigation: any = useNavigation();
  return (
    <Tap
      onPress={() => navigation.navigate("FundDetailScreen", { fundId: fund.id })}
      onLongPress={() => navigation.navigate("CreateFundScreen", { fundId: fund.id })}
    >
      <ListRow
        padded={false}
        leading={
          <GlyphPlate
            name={fund.icon_name || "piggy-bank-outline"}
            type={fund.icon_type || "material-community"}
            color={ordinalColorForId(fund.id, COLORS.ordinal)}
            size={40}
            radius={12}
          />
        }
        title={fund.name}
        subtitle={`${fund.target_cents != null ? "Goal set" : "Open-ended"}${fund.is_shared ? "  ·  Shared" : ""}`}
        chevron
      />
    </Tap>
  );
};

const GroupRow: React.FC<{ summary: GroupSummary; meId: string }> = ({ summary, meId }) => {
  const { COLORS } = useTheme();
  const navigation: any = useNavigation();
  const { group, members, my_net_cents } = summary;
  const isSettled = Math.abs(my_net_cents) <= 1;
  const positive = my_net_cents > 0;
  const others = members
    .filter((m) => m.user_id !== meId)
    .map((m) => (m.user_name || "").split(" ")[0])
    .filter(Boolean);
  const memberLine =
    others.length <= 3 ? ["You", ...others].join(", ") : `You, ${others.slice(0, 2).join(", ")} +${others.length - 2}`;

  return (
    <Tap
      onPress={() => navigation.navigate("GroupDetail", { grpId: group.id })}
      onLongPress={() => navigation.navigate("AddGroupExpense", { grpId: group.id })}
    >
      <ListRow
        padded={false}
        leading={
          <GlyphPlate
            name="account-group"
            type="material-community"
            color={ordinalColorForId(group.id, COLORS.ordinal)}
            size={40}
            radius={12}
          />
        }
        title={group.name}
        subtitle={memberLine}
        trailing={
          isSettled ? (
            <Settled />
          ) : (
            <NetAmount label={positive ? "you're owed" : "you owe"} cents={my_net_cents} tone={positive ? "down" : "up"} />
          )
        }
      />
    </Tap>
  );
};

const FriendRow: React.FC<{ row: UserBalance }> = ({ row }) => {
  const navigation: any = useNavigation();
  const positive = row.net_cents > 0;
  const isSettled = row.net_cents == 0;
  return (
    <Tap
      onPress={() =>
        navigation.navigate("FriendLedgerScreen", {
          friendId: row.id,
          friendName: row.name,
          netCents: row.net_cents,
        })
      }
      onLongPress={() => navigation.navigate("SplitInputScreen", { userId: row.id, userName: row.name })}
    >
      <ListRow
        padded={false}
        leading={<Avatar name={row.name} size={40} />}
        title={row.name}
        subtitle={isSettled ? "All settled up" : undefined}
        trailing={
          isSettled ? (
            <Settled />
          ) : (
            <NetAmount label={positive ? "owes you" : "you owe"} cents={row.net_cents} tone={positive ? "down" : "up"} />
          )
        }
      />
    </Tap>
  );
};

const BalancesScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const navigation: any = useNavigation();
  const [activeSegment, setActiveSegment] = useState<Segment>("friends");
  const userBalancesById = useExpensifyStore((state) => state.userbalances);
  const fundsById = useExpensifyStore((state) => state.funds);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const allRows = Object.values(userBalancesById);
  // Highest "owes you" first, "you owe" last (settled in the middle).
  const rows = (q ? allRows.filter((r) => matchesSearch(q, r.name)) : allRows).sort(
    (a, b) => b.net_cents - a.net_cents,
  );

  const allFunds = Object.values(fundsById);
  const funds = (q ? allFunds.filter((f) => matchesSearch(q, f.name)) : allFunds).sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at),
  );

  const groupsById = useExpensifyStore((state) => state.groups);
  const allGroups = Object.values(groupsById);
  const groups = (q ? allGroups.filter((g) => matchesSearch(q, g.group.name)) : allGroups).sort((a, b) =>
    (b.last_activity_at ?? b.group.created_at).localeCompare(a.last_activity_at ?? a.group.created_at),
  );

  const oldSplitSync: Appconstant = useExpensifyStore((state) => state.getAppconstantByKey("lastSplitSync"));
  const oldFundSync: Appconstant = useExpensifyStore((state) => state.getAppconstantByKey("lastFundSync"));
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const setUserBalancesInUI = useExpensifyStore((state) => state.setUserBalances);
  const setFundsInUI = useExpensifyStore((state) => state.setFunds);
  const setGroupsInUI = useExpensifyStore((state) => state.setGroups);
  const userId = useExpensifyStore((state) => state.getUserId());

  const fetchBalances = async () => {
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

  const closeSearch = () => {
    setSearching(false);
    setQuery("");
  };

  const hasAny =
    activeSegment === "friends" ? allRows.length > 0 : activeSegment === "groups" ? allGroups.length > 0 : allFunds.length > 0;

  const empty = useMemo(() => {
    if (q) {
      return <EmptyState icon="magnify" title="No matches" message={`Nothing matches “${query.trim()}”.`} />;
    }
    if (activeSegment === "friends") {
      return (
        <EmptyState
          icon="account-multiple-outline"
          title="All settled up"
          message="Split an expense with a friend and their balance shows up here."
        />
      );
    }
    if (activeSegment === "groups") {
      return (
        <EmptyState
          icon="account-group-outline"
          title="No groups yet"
          message="Track shared expenses for a trip, a flat or a team."
          actionLabel="Create a group"
          onAction={() => navigation.navigate("CreateGroupScreen")}
        />
      );
    }
    return (
      <EmptyState icon="piggy-bank-outline" title="No funds yet" message="Save towards a goal, alone or with friends." />
    );
  }, [q, query, activeSegment, navigation]);

  const listProps = {
    estimatedItemSize: 68,
    refreshing,
    onRefresh: () => handleRefresh(),
    keyboardShouldPersistTaps: "handled" as const,
    keyboardDismissMode: "on-drag" as const,
    showsVerticalScrollIndicator: false,
    contentContainerStyle: { paddingBottom: 120 },
    ListEmptyComponent: empty,
  };

  return (
    <View style={[styles.container, { backgroundColor: COLORS.paper }]}>
      <LargeTitle
        title="Balances"
        right={
          hasAny || searching ? (
            <HeaderIconButton
              icon={searching ? "close" : "magnify"}
              label={searching ? "Close search" : "Search"}
              tone="ink"
              onPress={searching ? closeSearch : () => setSearching(true)}
            />
          ) : undefined
        }
      />

      <View style={styles.controls}>
        <SegmentedControl
          value={activeSegment}
          onChange={setActiveSegment}
          options={[
            { key: "friends", label: "Friends" },
            { key: "groups", label: "Groups" },
            { key: "funds", label: "Funds" },
          ]}
        />
        {searching && (
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder={
              activeSegment === "friends" ? "Search people" : activeSegment === "groups" ? "Search groups" : "Search funds"
            }
            autoFocus
            style={styles.search}
          />
        )}
      </View>

      <View style={styles.container}>
        {activeSegment === "friends" ? (
          <FlashList
            {...listProps}
            data={rows}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <RowFrame last={index === rows.length - 1} COLORS={COLORS}>
                <FriendRow row={item} />
              </RowFrame>
            )}
          />
        ) : activeSegment === "groups" ? (
          <FlashList
            {...listProps}
            data={groups}
            keyExtractor={(item) => item.group.id}
            renderItem={({ item, index }) => (
              <RowFrame last={index === groups.length - 1} COLORS={COLORS}>
                <GroupRow summary={item} meId={userId} />
              </RowFrame>
            )}
          />
        ) : (
          <FlashList
            {...listProps}
            data={funds}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <RowFrame last={index === funds.length - 1} COLORS={COLORS}>
                <FundRow fund={item} />
              </RowFrame>
            )}
          />
        )}
      </View>
      <CustomFAB />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  gutter: { paddingHorizontal: SPACE.gutter },
  controls: { paddingHorizontal: SPACE.gutter, paddingTop: SPACE.sm, paddingBottom: SPACE.sm, gap: SPACE.md },
  search: { marginBottom: SPACE.xs },
  net: { alignItems: "flex-end" },
});

export default BalancesScreen;

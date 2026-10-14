import React, { useCallback, useMemo, useState } from "react";
import { View, SectionList, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Alert } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { Icon } from "react-native-elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONTS, SIZES } from "../constants";
import { ColorPalette } from "../constants/theme";
import { useTheme } from "../contexts/ThemeContext";
import { Avatar, avatarColor } from "../components/primitives";
import MonthlyTrendChart from "../components/MonthlyTrendChart";
import { fetchFundDetail, deleteFundEntry } from "../services/Funds";
import { fmt, monthLabel, buildCumulativeTrend, EntryCard } from "./FundDetailScreen";
import { Fund } from "../types/entity/Fund";
import { FundEntry } from "../types/entity/FundEntry";

// The "one person" drill-in — everything about a single contributor's
// relationship to a shared fund: their own running total, their own trend,
// and their own timeline. Reached by tapping a contributor row on
// FundDetailScreen; that screen already knows fund/contributorId/name so
// this screen re-fetches only the entries, filters to this person, and
// renders with the same EntryCard/trend building blocks the parent uses.
const FundContributorScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { fund, contributorId, contributorName } = route.params as {
    fund: Fund;
    contributorId: string;
    contributorName: string;
  };

  const [loading, setLoading] = useState(true);
  const [allEntries, setAllEntries] = useState<FundEntry[]>([]);
  const [fundTotalCents, setFundTotalCents] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchFundDetail(fund.id);
      setAllEntries(res.entries);
      setFundTotalCents(res.totalContributedCents);
    } finally {
      setLoading(false);
    }
  }, [fund.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const entries = useMemo(
    () => allEntries.filter((e) => e.contributor_id === contributorId),
    [allEntries, contributorId],
  );

  const activeEntries = useMemo(() => entries.filter((e) => !e.is_deleted), [entries]);
  const totalCents = useMemo(
    () =>
      activeEntries.reduce(
        (s, e) => s + (e.direction === "CONTRIBUTION" ? e.amount_cents : -e.amount_cents),
        0,
      ),
    [activeEntries],
  );
  const sharePct = fundTotalCents > 0 ? Math.round((Math.max(0, totalCents) / fundTotalCents) * 100) : 0;

  const { points: trendPoints, activeMonthCount } = useMemo(() => buildCumulativeTrend(entries), [entries]);
  const showTrend = activeMonthCount >= 2;

  const sections = useMemo(() => {
    const groups = new Map<string, FundEntry[]>();
    activeEntries.forEach((e) => {
      const key = monthLabel(e.created_at);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    });
    return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
  }, [activeEntries]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  const color = avatarColor(contributorName);

  const renderHeader = () => (
    <>
      <View style={styles.heroCard}>
        <Avatar name={contributorName} size={56} textStyle={{ fontSize: 20 }} />
        <Text style={[styles.heroAmount, { color }]}>{fmt(totalCents)}</Text>
        <Text style={styles.heroCaption}>
          {activeEntries.length} {activeEntries.length === 1 ? "entry" : "entries"} · {sharePct}% of "{fund.name}"
        </Text>
      </View>

      {showTrend && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TREND</Text>
          <View style={styles.trendCard}>
            <MonthlyTrendChart data={trendPoints} height={160} lineColor={color} countLabel="entries" />
          </View>
        </View>
      )}

      <View style={styles.activityHeader}>
        <Text style={styles.sectionLabel}>ACTIVITY</Text>
      </View>
    </>
  );

  const renderEntry = ({ item }: { item: FundEntry }) => (
    <EntryCard
      entry={item}
      onPress={() => navigation.navigate("AddFundEntryScreen", { fund, entry: item })}
      onLongPress={() => {
        Alert.alert("Delete entry", "Are you sure? This can't be undone.", [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              await deleteFundEntry(item.id);
              load();
            },
          },
        ]);
      }}
    />
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + SIZES.base }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="arrow-left" type="material-community" size={24} color={COLORS.ink} />
        </TouchableOpacity>
        <View style={styles.headerIdentity}>
          <Avatar name={contributorName} size={30} />
          <Text style={styles.headerName} numberOfLines={1}>{contributorName}</Text>
        </View>
      </View>

      <SectionList
        showsVerticalScrollIndicator={false}
        sections={sections}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.monthHeader}>{title}</Text>
        )}
        renderItem={renderEntry}
        ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={() => <Text style={styles.emptyText}>No entries yet</Text>}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
};

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.paper },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.paper },

    header: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: SIZES.padding, paddingBottom: SIZES.base, gap: SIZES.base,
    },
    headerBtn: { padding: 4 },
    headerIdentity: { flex: 1, flexDirection: "row", alignItems: "center", gap: SIZES.base + 2 },
    headerName: { ...FONTS.h2, color: COLORS.ink, flex: 1 },

    heroCard: { alignItems: "center", marginTop: SIZES.padding, marginBottom: SIZES.padding },
    heroAmount: { ...FONTS.amountSection, marginTop: SIZES.base + 4 },
    heroCaption: { ...FONTS.caption, color: COLORS.inkMuted, marginTop: 4 },

    section: { marginHorizontal: SIZES.padding, marginBottom: SIZES.padding },
    sectionLabel: { ...FONTS.sectionLabel, color: COLORS.inkMuted, textTransform: "uppercase", marginBottom: 10 },
    activityHeader: { marginHorizontal: SIZES.padding, marginBottom: SIZES.base + 2 },
    trendCard: { overflow: "hidden" },

    monthHeader: {
      ...FONTS.sectionLabel, color: COLORS.inkMuted, letterSpacing: 0.6,
      textTransform: "uppercase", paddingHorizontal: SIZES.padding,
      paddingTop: SIZES.padding * 0.6, paddingBottom: SIZES.base,
      backgroundColor: COLORS.paper,
    },
    listContent: { paddingBottom: SIZES.padding },
    rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.hairline, marginHorizontal: SIZES.padding },
    emptyText: { textAlign: "center", marginTop: 30, ...FONTS.body3, color: COLORS.inkMuted },
  });

export default FundContributorScreen;

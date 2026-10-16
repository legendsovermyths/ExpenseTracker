import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { SPACE } from "../constants";
import MonthlyTrendChart from "../components/MonthlyTrendChart";
import { Amount, EmptyState, Page, PageList, SectionLabel, SkeletonList, Text, avatarColor } from "../components/ui";
import { fetchFundDetail } from "../services/Funds";
import {
  EntryCard,
  MonthLabel,
  activityRows,
  buildCumulativeTrend,
  confirmDeleteEntry,
} from "./FundDetailScreen";
import { Fund } from "../types/entity/Fund";
import { FundEntry } from "../types/entity/FundEntry";

// The "one person" drill-in — everything about a single contributor's
// relationship to a shared fund: their own running total, their own trend,
// and their own timeline. Reached by tapping a contributor row on
// FundDetailScreen; that screen already knows fund/contributorId/name so
// this screen re-fetches only the entries, filters to this person, and
// renders with the same EntryCard/trend building blocks the parent uses.
const FundContributorScreen: React.FC = () => {
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

  const rows = useMemo(() => activityRows(activeEntries), [activeEntries]);

  if (loading && allEntries.length === 0) {
    return (
      <Page title={contributorName}>
        <SkeletonList rows={6} />
      </Page>
    );
  }

  const header = (
    <View style={styles.gutter}>
      <View style={styles.total}>
        <Text variant="body" tone="muted">
          Net contributed
        </Text>
        <Amount cents={totalCents} variant="amountLarge" />
      </View>

      {showTrend && (
        <>
          <SectionLabel title="Trend" />
          <MonthlyTrendChart
            data={trendPoints}
            height={160}
            lineColor={avatarColor(contributorName)}
            countLabel="entries"
          />
        </>
      )}

      <SectionLabel title="Activity" />
    </View>
  );

  return (
    <PageList
      title={contributorName}
      subtitle={`${activeEntries.length} ${activeEntries.length === 1 ? "entry" : "entries"}  ·  ${sharePct}% of ${fund.name}`}
      header={header}
      data={rows}
      keyExtractor={(r) => r.key}
      getItemType={(r) => r.type}
      estimatedItemSize={60}
      renderItem={({ item }) =>
        item.type === "month" ? (
          <MonthLabel title={item.title} />
        ) : (
          <EntryCard
            entry={item.entry}
            onPress={() => navigation.navigate("AddFundEntryScreen", { fund, entry: item.entry })}
            onLongPress={() => confirmDeleteEntry(item.entry, load)}
          />
        )
      }
      ListEmptyComponent={<EmptyState icon="piggy-bank-outline" title="No entries yet" />}
    />
  );
};

const styles = StyleSheet.create({
  gutter: { paddingHorizontal: SPACE.gutter },
  total: { paddingTop: SPACE.lg, gap: SPACE.xs },
});

export default FundContributorScreen;

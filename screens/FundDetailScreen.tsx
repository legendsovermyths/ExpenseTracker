import React, { useCallback, useMemo, useState, useRef } from "react";
import { StyleSheet, View } from "react-native";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { RADIUS, SPACE } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import MonthlyTrendChart from "../components/MonthlyTrendChart";
import {
  Amount,
  Avatar,
  BottomBar,
  Button,
  EmptyState,
  GlyphPlate,
  HeaderActions,
  HeaderIconButton,
  Icon,
  ListRow,
  Page,
  PageList,
  Pressable,
  SearchField,
  SectionLabel,
  SkeletonList,
  Sparkline,
  Text,
  avatarColor,
  confirm,
  formatMoney,
  toast,
  FeedbackRow,
  DeltaChip,
  haptic,
  useListChangeAnimation,
} from "../components/ui";
import { fetchFundDetail, deleteFundEntry } from "../services/Funds";
import { useExpensifyStore } from "../store/store";
import { Fund } from "../types/entity/Fund";
import { FundEntry } from "../types/entity/FundEntry";
import { matchesSearch } from "../services/Search";
import { ProgressRing, ShareBar } from "../components/charts";
import { markTotalChanged } from "../services/Feedback";

const ordinalColorForId = (id: string, palette: readonly string[]): string => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
};

export const monthLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

// Stable grouping key — distinct from the display-only monthLabel above.
const monthKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}`;
};

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Cumulative fund balance, one point per calendar month from the first
// entry through the current month — walked continuously (not just the
// months that happen to have activity) so the line never fakes a reset
// just because a month was quiet. `activeMonthCount` (real activity months)
// is what gates whether the trend section renders at all, not the
// gap-filled point count.
export function buildCumulativeTrend(entries: FundEntry[]) {
  const active = entries.filter((e) => !e.is_deleted);
  if (active.length === 0) return { points: [] as any[], activeMonthCount: 0 };

  const sorted = [...active].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const buckets = new Map<string, FundEntry[]>();
  sorted.forEach((e) => {
    const key = monthKey(e.created_at);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(e);
  });

  const first = new Date(sorted[0].created_at);
  let cursor = new Date(first.getFullYear(), first.getMonth(), 1);
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), 1);

  const points: any[] = [];
  let running = 0;
  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
    const bucket = buckets.get(key) ?? [];
    const netDelta = bucket.reduce(
      (sum, e) =>
        sum +
        (e.direction === "CONTRIBUTION" ? e.amount_cents : -e.amount_cents),
      0,
    );
    running += netDelta;
    points.push({
      value: running / 100,
      label: SHORT_MONTHS[cursor.getMonth()],
      month: cursor.getMonth(),
      year: cursor.getFullYear(),
      transactionCount: bucket.length,
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return { points, activeMonthCount: buckets.size };
}

// Per-contributor monthly net series for the Contributors section's
// sparkline — only the months that person was actually active in (no
// gap-filling here, unlike buildCumulativeTrend; a sparkline is a shape,
// not a timeline, so Sparkline's own <2-point gate is all it needs).
function monthlySeriesForContributor(
  entries: FundEntry[],
  contributorId: string,
): number[] {
  const active = entries.filter(
    (e) => !e.is_deleted && e.contributor_id === contributorId,
  );
  if (active.length === 0) return [];
  const sorted = [...active].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const buckets = new Map<string, number>();
  sorted.forEach((e) => {
    const key = monthKey(e.created_at);
    const delta =
      e.direction === "CONTRIBUTION" ? e.amount_cents : -e.amount_cents;
    buckets.set(key, (buckets.get(key) ?? 0) + delta);
  });
  return Array.from(buckets.values());
}

function computeFundTotals(entries: FundEntry[]) {
  const active = entries.filter((e) => !e.is_deleted);
  const totalContributedCents = active
    .filter((e) => e.direction === "CONTRIBUTION")
    .reduce((s, e) => s + e.amount_cents, 0);
  const totalWithdrawnCents = active
    .filter((e) => e.direction === "WITHDRAWAL")
    .reduce((s, e) => s + e.amount_cents, 0);
  const thisMonthKey = monthKey(new Date().toISOString());
  const netThisMonthCents = active
    .filter((e) => monthKey(e.created_at) === thisMonthKey)
    .reduce(
      (s, e) =>
        s + (e.direction === "CONTRIBUTION" ? e.amount_cents : -e.amount_cents),
      0,
    );
  return { totalContributedCents, totalWithdrawnCents, netThisMonthCents };
}

// Null whenever a projection wouldn't be meaningful: no goal, goal already
// met, or no positive contribution pace to extrapolate from.
function computeGoalPace(fund: Fund, totalContributedCents: number) {
  if (fund.target_cents == null) return null;
  const remainingCents = fund.target_cents - totalContributedCents;
  if (remainingCents <= 0) return null;

  const created = new Date(fund.created_at);
  const now = new Date();
  const monthsActive = Math.max(
    1,
    (now.getFullYear() - created.getFullYear()) * 12 +
      (now.getMonth() - created.getMonth()) +
      1,
  );
  const avgMonthlyCents = totalContributedCents / monthsActive;
  if (avgMonthlyCents <= 0) return null;

  const monthsToGo = Math.ceil(remainingCents / avgMonthlyCents);
  const completionDate = new Date(
    now.getFullYear(),
    now.getMonth() + monthsToGo,
    1,
  );
  return { avgMonthlyCents, completionDate };
}

// Exported so FundContributorScreen (a single person's filtered view of the
// same fund) renders identical rows rather than a near-duplicate component.
export const EntryCard: React.FC<{
  entry: FundEntry;
  contributorName?: string;
  onPress: () => void;
  onLongPress: () => void;
}> = ({ entry, contributorName, onPress, onLongPress }) => {
  const { COLORS } = useTheme();
  const isContribution = entry.direction === "CONTRIBUTION";
  const color = isContribution ? COLORS.deltaDown : COLORS.deltaUp;

  return (
    <ListRow
      padded={false}
      style={styles.gutter}
      leading={
        contributorName ? (
          <View style={styles.avatarBadgeWrap}>
            <Avatar name={contributorName} size={36} />
            <View
              style={[
                styles.directionBadge,
                { backgroundColor: color, borderColor: COLORS.paper },
              ]}
            >
              <Icon
                name={isContribution ? "arrow-down" : "arrow-up"}
                size={9}
                color={COLORS.paper}
              />
            </View>
          </View>
        ) : (
          <GlyphPlate
            name={isContribution ? "tray-arrow-down" : "tray-arrow-up"}
            color={color}
            size={36}
            radius={10}
          />
        )
      }
      title={entry.note || (isContribution ? "Contribution" : "Withdrawal")}
      subtitle={new Date(entry.created_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      })}
      trailing={
        <Amount
          cents={isContribution ? entry.amount_cents : -entry.amount_cents}
          sign="always"
          tone={isContribution ? "down" : "up"}
        />
      }
      onPress={onPress}
      onLongPress={onLongPress}
    />
  );
};

/** Long-press delete shared by the fund and contributor activity lists. */
export const confirmDeleteEntry = async (
  entry: FundEntry,
  onDeleted: () => void,
) => {
  const ok = await confirm({
    title: "Delete this entry?",
    message: "This can't be undone.",
  });
  if (!ok) return;
  try {
    await deleteFundEntry(entry.id);
    markTotalChanged(
      `fund:${entry.fund_id}`,
      entry.direction === "WITHDRAWAL"
        ? entry.amount_cents
        : -entry.amount_cents,
    );
    haptic("light");
    onDeleted();
  } catch {
    toast("Couldn't delete the entry", "error");
  }
};

/** Activity rows flattened for FlashList: month labels interleaved with entries. */
export type ActivityRow =
  | { type: "month"; key: string; title: string }
  | { type: "entry"; key: string; entry: FundEntry };

export const activityRows = (entries: FundEntry[]): ActivityRow[] => {
  const rows: ActivityRow[] = [];
  let current = "";
  entries.forEach((e) => {
    const title = monthLabel(e.created_at);
    if (title !== current) {
      current = title;
      rows.push({ type: "month", key: `m-${title}`, title });
    }
    rows.push({ type: "entry", key: e.id, entry: e });
  });
  return rows;
};

export const MonthLabel: React.FC<{ title: string }> = ({ title }) => (
  <Text variant="label" tone="muted" style={styles.monthLabel}>
    {title}
  </Text>
);

// The proportional bar+legend shape for exactly two parties — reused for both
// the shared (you/partner) and solo (contributed/withdrawn) breakdowns.
const TwoWayBar: React.FC<{
  leftLabel?: string;
  leftAmountCents: number;
  leftColor: string;
  rightLabel?: string;
  rightAmountCents: number;
  rightColor: string;
}> = ({
  leftLabel,
  leftAmountCents,
  leftColor,
  rightLabel,
  rightAmountCents,
  rightColor,
}) => {
  const total = leftAmountCents + rightAmountCents;
  const leftFrac = total > 0 ? leftAmountCents / total : 0.5;
  return (
    <>
      <ShareBar
        parts={[
          { value: Math.max(leftFrac, 0.02), color: leftColor },
          { value: Math.max(1 - leftFrac, 0.02), color: rightColor },
        ]}
        height={8}
      />
      {leftLabel && rightLabel && (
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: leftColor }]} />
            <Text variant="caption" tone="muted">
              {leftLabel} · {formatMoney(leftAmountCents)}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: rightColor }]} />
            <Text variant="caption" tone="muted">
              {rightLabel} · {formatMoney(rightAmountCents)}
            </Text>
          </View>
        </View>
      )}
    </>
  );
};

const FundDetailScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { fundId } = route.params as { fundId: string };
  const me = useExpensifyStore((s) => s.getUserId());
  const userBalancesById = useExpensifyStore((s) => s.userbalances);
  const cachedName = useExpensifyStore((s) => s.funds[fundId]?.name);

  const [loading, setLoading] = useState(true);
  const [fund, setFund] = useState<Fund | null>(null);
  const [entries, setEntries] = useState<FundEntry[]>([]);
  const [totalCents, setTotalCents] = useState(0);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchFundDetail(fundId);
      setFund(res.fund);
      setEntries(res.entries);
      setTotalCents(res.totalContributedCents);
    } finally {
      setLoading(false);
    }
  }, [fundId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const visibleEntries = query.trim()
    ? entries.filter((e) => matchesSearch(query, e.note))
    : entries;

  const rows = useMemo(() => activityRows(visibleEntries), [visibleEntries]);
  const activityListRef = useRef<any>(null);
  useListChangeAnimation(
    visibleEntries.map((e) => e.id),
    activityListRef,
  );

  const { points: trendPoints, activeMonthCount } = useMemo(
    () => buildCumulativeTrend(entries),
    [entries],
  );
  const { totalContributedCents, totalWithdrawnCents, netThisMonthCents } =
    useMemo(() => computeFundTotals(entries), [entries]);
  const contributorTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    entries.forEach((e) => {
      if (e.is_deleted) return;
      const delta =
        e.direction === "CONTRIBUTION" ? e.amount_cents : -e.amount_cents;
      totals[e.contributor_id] = (totals[e.contributor_id] ?? 0) + delta;
    });
    return totals;
  }, [entries]);

  // Only the first load shows the skeleton; refocus reloads keep the content.
  if (loading && !fund) {
    return (
      <Page title={cachedName || "Fund"}>
        <SkeletonList rows={6} />
      </Page>
    );
  }
  if (!fund) return <Page title={cachedName || "Fund"} />;

  const color = ordinalColorForId(fund.id, COLORS.ordinal);
  const hasTarget = fund.target_cents != null;
  const progress = hasTarget
    ? Math.max(0, Math.min(1, totalCents / fund.target_cents!))
    : 0;
  const progressPct = Math.round(progress * 100);
  const goalPace = hasTarget
    ? computeGoalPace(fund, totalContributedCents)
    : null;

  const iAmOwner = fund.owner_id === me;
  const partnerId = iAmOwner ? fund.other_participant_id : fund.owner_id;
  const partnerName = fund.is_shared
    ? iAmOwner
      ? (fund.other_participant_name ??
        userBalancesById[partnerId!]?.name ??
        "Partner")
      : (userBalancesById[partnerId!]?.name ?? "Partner")
    : null;
  const myTotal = Math.max(0, contributorTotals[me] ?? 0);
  const partnerTotal = partnerId
    ? Math.max(0, contributorTotals[partnerId] ?? 0)
    : 0;
  const showSharedBreakdown = fund.is_shared && myTotal + partnerTotal > 0;
  const showSoloBreakdown =
    !fund.is_shared && totalContributedCents + totalWithdrawnCents > 0;
  const showTrend = activeMonthCount >= 2;

  // Ranked contributor rows — who put in what, highest first.
  const contributors = showSharedBreakdown
    ? [
        { id: me, name: "You", total: myTotal },
        { id: partnerId!, name: partnerName ?? "Partner", total: partnerTotal },
      ].sort((a, b) => b.total - a.total)
    : [];
  const contributorsTotal = myTotal + partnerTotal;

  const closeSearch = () => {
    setQuery("");
    setSearching(false);
  };

  const hero = (
    <View style={styles.hero}>
      {hasTarget ? (
        <ProgressRing
          progress={
            fund.target_cents! > 0 ? totalCents / fund.target_cents! : 0
          }
          color={color}
          size={184}
          accessibilityLabel={`${progressPct}% of goal funded`}
        >
          <Text
            variant="amountLarge"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={styles.ringAmount}
          >
            {formatMoney(totalCents)}
          </Text>
          <Text variant="caption" tone="muted">
            of {formatMoney(fund.target_cents!)}
          </Text>
        </ProgressRing>
      ) : (
        <>
          <GlyphPlate
            name={fund.icon_name || "piggy-bank-outline"}
            type={fund.icon_type}
            color={color}
            size={56}
            radius={18}
          />
          <Amount
            cents={totalCents}
            variant="display"
            style={styles.heroAmount}
            animated
          />
          <DeltaChip totalKey={`fund:${fund.id}`} positiveIsGood />
        </>
      )}

      <View style={styles.caption}>
        <Text variant="callout" tone="muted">
          {hasTarget ? `${progressPct}% funded` : "Total saved"}
        </Text>
        {netThisMonthCents !== 0 && (
          <>
            <Text variant="callout" tone="subtle">
              {"  ·  "}
            </Text>
            <Amount
              cents={netThisMonthCents}
              variant="callout"
              sign="always"
              tone={netThisMonthCents > 0 ? "down" : "up"}
            />
            <Text variant="callout" tone="muted">
              {" this month"}
            </Text>
          </>
        )}
      </View>
      {goalPace && (
        <Text variant="caption" tone="subtle" style={styles.pace}>
          On pace for{" "}
          {goalPace.completionDate.toLocaleDateString("en-IN", {
            month: "long",
            year: "numeric",
          })}
        </Text>
      )}
    </View>
  );

  const header = searching ? (
    <View style={[styles.gutter, styles.searchBar]}>
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder={`Search ${fund.name} entries`}
        autoFocus
        style={styles.flex}
      />
      <Pressable onPress={closeSearch} accessibilityLabel="Close search">
        <Text variant="headline" tone="accent">
          Cancel
        </Text>
      </Pressable>
    </View>
  ) : (
    <View style={styles.gutter}>
      {hero}

      {showTrend && (
        <>
          <SectionLabel title="Trend" />
          <MonthlyTrendChart
            data={trendPoints}
            height={160}
            lineColor={color}
            countLabel="entries"
          />
        </>
      )}

      {showSharedBreakdown && (
        <>
          <SectionLabel title="Contributors" />
          {contributors.map((c) => {
            const series = monthlySeriesForContributor(entries, c.id);
            const pct =
              contributorsTotal > 0
                ? Math.round((c.total / contributorsTotal) * 100)
                : 0;
            return (
              <ListRow
                key={c.id}
                padded={false}
                leading={<Avatar name={c.name} size={34} />}
                title={c.name}
                subtitle={`${pct}% of total`}
                trailing={
                  <View style={styles.contributorRight}>
                    <Sparkline
                      data={series}
                      color={avatarColor(c.name)}
                      width={48}
                      height={14}
                    />
                    <Amount cents={c.total} />
                  </View>
                }
                chevron
                onPress={() =>
                  navigation.navigate("FundContributorScreen", {
                    fund,
                    contributorId: c.id,
                    contributorName: c.name,
                  })
                }
              />
            );
          })}
          <View style={styles.barWrap}>
            <TwoWayBar
              leftAmountCents={myTotal}
              leftColor={avatarColor("You")}
              rightAmountCents={partnerTotal}
              rightColor={avatarColor(partnerName ?? "Partner")}
            />
          </View>
        </>
      )}

      {showSoloBreakdown && (
        <>
          <SectionLabel title="Contributions vs withdrawals" />
          <TwoWayBar
            leftLabel="Contributed"
            leftAmountCents={totalContributedCents}
            leftColor={COLORS.deltaDown}
            rightLabel="Withdrawn"
            rightAmountCents={totalWithdrawnCents}
            rightColor={COLORS.deltaUp}
          />
        </>
      )}

      <SectionLabel title="Activity" />
    </View>
  );

  return (
    <PageList
      listRef={activityListRef}
      title={fund.name}
      subtitle={fund.is_shared ? `Shared with ${partnerName}` : undefined}
      right={
        <HeaderActions>
          <HeaderIconButton
            icon="magnify"
            label="Search entries"
            tone="ink"
            onPress={() => setSearching(true)}
          />
          <HeaderIconButton
            icon="pencil-outline"
            label="Edit fund"
            tone="ink"
            onPress={() =>
              navigation.navigate("CreateFundScreen", { fundId: fund.id })
            }
          />
        </HeaderActions>
      }
      header={header}
      data={rows}
      keyExtractor={(r) => r.key}
      getItemType={(r) => r.type}
      estimatedItemSize={60}
      renderItem={({ item }) =>
        item.type === "month" ? (
          <MonthLabel title={item.title} />
        ) : (
          <FeedbackRow kind="fundEntry" id={item.entry.id}>
            <EntryCard
              entry={item.entry}
              contributorName={
                fund.is_shared
                  ? item.entry.contributor_id === me
                    ? "You"
                    : (partnerName ?? undefined)
                  : undefined
              }
              onPress={() =>
                navigation.navigate("AddFundEntryScreen", {
                  fund,
                  entry: item.entry,
                })
              }
              onLongPress={() => confirmDeleteEntry(item.entry, load)}
            />
          </FeedbackRow>
        )
      }
      ListEmptyComponent={
        query.trim() ? (
          <EmptyState icon="magnify" title="No matching entries" />
        ) : (
          <EmptyState
            icon="piggy-bank-outline"
            title="No contributions yet"
            message="Add the first contribution to start tracking this fund."
          />
        )
      }
      refreshing={refreshing}
      onRefresh={refresh}
      footer={
        searching ? undefined : (
          <BottomBar>
            <Button
              title="Contribute"
              icon="plus"
              onPress={() =>
                navigation.navigate("AddFundEntryScreen", {
                  fund,
                  direction: "CONTRIBUTION",
                })
              }
            />
            <Button
              title="Withdraw"
              variant="secondary"
              onPress={() =>
                navigation.navigate("AddFundEntryScreen", {
                  fund,
                  direction: "WITHDRAWAL",
                })
              }
            />
          </BottomBar>
        )
      }
    />
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gutter: { paddingHorizontal: SPACE.gutter },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    paddingVertical: SPACE.sm,
  },
  hero: { alignItems: "center", paddingTop: SPACE.lg, paddingBottom: SPACE.sm },
  ringAmount: { maxWidth: 120 },
  heroAmount: { marginTop: SPACE.md },
  caption: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: SPACE.md,
  },
  pace: { marginTop: SPACE.xs },
  contributorRight: { alignItems: "flex-end", gap: SPACE.xs },
  barWrap: { marginTop: SPACE.sm },
  legendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: SPACE.sm,
    width: "100%",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: SPACE.xs + 2 },
  legendDot: { width: 8, height: 8, borderRadius: RADIUS.sm },
  monthLabel: {
    paddingHorizontal: SPACE.gutter,
    paddingTop: SPACE.lg,
    paddingBottom: SPACE.xs,
  },
  avatarBadgeWrap: { width: 36, height: 36 },
  directionBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default FundDetailScreen;

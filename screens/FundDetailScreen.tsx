import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  SectionList,
  StyleSheet,
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { Icon } from "react-native-elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PieChart } from "react-native-gifted-charts";
import { FONTS, SIZES } from "../constants";
import { ColorPalette } from "../constants/theme";
import { useTheme } from "../contexts/ThemeContext";
import { GlyphPlate, Surface, Avatar, Sparkline, avatarColor } from "../components/primitives";
import MonthlyTrendChart from "../components/MonthlyTrendChart";
import { fetchFundDetail, deleteFundEntry } from "../services/Funds";
import { formatAmountWithCommas } from "../services/Utils";
import { useExpensifyStore } from "../store/store";
import { Fund } from "../types/entity/Fund";
import { FundEntry } from "../types/entity/FundEntry";

// Exported for reuse by FundContributorScreen (same fund, filtered to one person).
export const fmt = (cents: number) => `₹${formatAmountWithCommas(Math.abs(cents) / 100, true)}`;
const fmtSigned = (cents: number) => `${cents < 0 ? "-" : cents > 0 ? "+" : ""}${fmt(cents)}`;

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

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
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
      (sum, e) => sum + (e.direction === "CONTRIBUTION" ? e.amount_cents : -e.amount_cents),
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
function monthlySeriesForContributor(entries: FundEntry[], contributorId: string): number[] {
  const active = entries.filter((e) => !e.is_deleted && e.contributor_id === contributorId);
  if (active.length === 0) return [];
  const sorted = [...active].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const buckets = new Map<string, number>();
  sorted.forEach((e) => {
    const key = monthKey(e.created_at);
    const delta = e.direction === "CONTRIBUTION" ? e.amount_cents : -e.amount_cents;
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
    .reduce((s, e) => s + (e.direction === "CONTRIBUTION" ? e.amount_cents : -e.amount_cents), 0);
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
    (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth()) + 1,
  );
  const avgMonthlyCents = totalContributedCents / monthsActive;
  if (avgMonthlyCents <= 0) return null;

  const monthsToGo = Math.ceil(remainingCents / avgMonthlyCents);
  const completionDate = new Date(now.getFullYear(), now.getMonth() + monthsToGo, 1);
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
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const isContribution = entry.direction === "CONTRIBUTION";
  const color = isContribution ? COLORS.deltaDown : COLORS.deltaUp;

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} onLongPress={onLongPress} delayLongPress={250}>
      <View style={styles.cardRow}>
        {contributorName ? (
          <View style={styles.avatarBadgeWrap}>
            <Avatar name={contributorName} size={42} />
            <View style={[styles.directionBadge, { backgroundColor: color, borderColor: COLORS.paper }]}>
              <Icon
                name={isContribution ? "arrow-down" : "arrow-up"}
                type="material-community"
                size={9}
                color={COLORS.paper}
              />
            </View>
          </View>
        ) : (
          <GlyphPlate
            name={isContribution ? "tray-arrow-down" : "tray-arrow-up"}
            color={color}
            size={42}
            radius={12}
          />
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.descText} numberOfLines={1}>
            {entry.note || (isContribution ? "Contribution" : "Withdrawal")}
          </Text>
          <Text style={styles.dateText}>
            {new Date(entry.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </Text>
        </View>
        <Text style={[styles.amountText, { color }]}>
          {isContribution ? "+" : "-"}
          {fmt(entry.amount_cents)}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// The proportional bar+legend shape SplitSummary.tsx already established for
// a 2-way split — right form for exactly 2 parties, reused for both the
// shared (you/partner) and solo (contributed/withdrawn) breakdown cases.
const TwoWayBreakdown: React.FC<{
  leftLabel: string;
  leftAmountCents: number;
  leftColor: string;
  rightLabel: string;
  rightAmountCents: number;
  rightColor: string;
  styles: ReturnType<typeof createStyles>;
}> = ({ leftLabel, leftAmountCents, leftColor, rightLabel, rightAmountCents, rightColor, styles }) => {
  const total = leftAmountCents + rightAmountCents;
  const leftFrac = total > 0 ? leftAmountCents / total : 0.5;
  return (
    <>
      <View style={styles.bar}>
        <View style={{ flex: Math.max(leftFrac, 0.02), backgroundColor: leftColor }} />
        <View style={{ flex: Math.max(1 - leftFrac, 0.02), backgroundColor: rightColor }} />
      </View>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: leftColor }]} />
          <Text style={styles.legendText}>{leftLabel} · {fmt(leftAmountCents)}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: rightColor }]} />
          <Text style={styles.legendText}>{rightLabel} · {fmt(rightAmountCents)}</Text>
        </View>
      </View>
    </>
  );
};

const FundDetailScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { fundId } = route.params as { fundId: string };
  const me = useExpensifyStore((s) => s.getUserId());
  const userBalancesById = useExpensifyStore((s) => s.userbalances);

  const [loading, setLoading] = useState(true);
  const [fund, setFund] = useState<Fund | null>(null);
  const [entries, setEntries] = useState<FundEntry[]>([]);
  const [totalCents, setTotalCents] = useState(0);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");

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

  const visibleEntries = query.trim()
    ? entries.filter((e) => (e.note || "").toLowerCase().includes(query.trim().toLowerCase()))
    : entries;

  const sections = useMemo(() => {
    const groups = new Map<string, FundEntry[]>();
    visibleEntries.forEach((e) => {
      const key = monthLabel(e.created_at);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    });
    return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
  }, [visibleEntries]);

  const { points: trendPoints, activeMonthCount } = useMemo(() => buildCumulativeTrend(entries), [entries]);
  const { totalContributedCents, totalWithdrawnCents, netThisMonthCents } = useMemo(
    () => computeFundTotals(entries),
    [entries],
  );
  const contributorTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    entries.forEach((e) => {
      if (e.is_deleted) return;
      const delta = e.direction === "CONTRIBUTION" ? e.amount_cents : -e.amount_cents;
      totals[e.contributor_id] = (totals[e.contributor_id] ?? 0) + delta;
    });
    return totals;
  }, [entries]);

  if (loading || !fund) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  const color = ordinalColorForId(fund.id, COLORS.ordinal);
  const hasTarget = fund.target_cents != null;
  const progress = hasTarget ? Math.max(0, Math.min(1, totalCents / fund.target_cents!)) : 0;
  const progressPct = Math.round(progress * 100);
  const goalPace = hasTarget ? computeGoalPace(fund, totalContributedCents) : null;

  const iAmOwner = fund.owner_id === me;
  const partnerId = iAmOwner ? fund.other_participant_id : fund.owner_id;
  const partnerName = fund.is_shared
    ? iAmOwner
      ? fund.other_participant_name ?? userBalancesById[partnerId!]?.name ?? "Partner"
      : userBalancesById[partnerId!]?.name ?? "Partner"
    : null;
  const myTotal = Math.max(0, contributorTotals[me] ?? 0);
  const partnerTotal = partnerId ? Math.max(0, contributorTotals[partnerId] ?? 0) : 0;
  const showSharedBreakdown = fund.is_shared && myTotal + partnerTotal > 0;
  const showSoloBreakdown = !fund.is_shared && totalContributedCents + totalWithdrawnCents > 0;
  const showTrend = activeMonthCount >= 2;

  // Ranked contributor rows — the shared-fund "who put in what" list that
  // replaces the old text-only breakdown. Sorted by amount, highest first.
  const contributors = showSharedBreakdown
    ? [
        { id: me, name: "You", total: myTotal },
        { id: partnerId!, name: partnerName ?? "Partner", total: partnerTotal },
      ].sort((a, b) => b.total - a.total)
    : [];
  const contributorsTotal = myTotal + partnerTotal;

  const monthDeltaColor =
    netThisMonthCents > 0 ? COLORS.deltaDown : netThisMonthCents < 0 ? COLORS.deltaUp : COLORS.inkMuted;

  const renderHeader = () => (
    <>
      {/* Hero — one section, not three: a focal number (ring when there's a
          goal to show progress toward, a plain headline otherwise) plus a
          single caption line carrying this month's delta and, when there's
          a real pace to report, one more quiet line for it. No boxed
          sub-cards, no icon-plus-sentence insight — same restraint as
          Statistics' own headline block. */}
      <View style={styles.heroCard}>
        {hasTarget ? (
          <View style={styles.ringWrap}>
            <PieChart
              data={[
                { value: Math.max(totalCents, 1), color },
                { value: Math.max(fund.target_cents! - totalCents, 0), color: COLORS.surface1 },
              ]}
              donut
              radius={92}
              innerRadius={66}
              innerCircleColor={COLORS.paper}
              centerLabelComponent={() => (
                <View style={styles.ringCenter}>
                  <Text style={styles.ringAmount} numberOfLines={1}>{fmt(totalCents)}</Text>
                  <Text style={styles.ringCaption}>of {fmt(fund.target_cents!)}</Text>
                </View>
              )}
            />
          </View>
        ) : (
          <View style={styles.headlineWrap}>
            <GlyphPlate name={fund.icon_name || "piggy-bank-outline"} type={fund.icon_type} color={color} size={44} radius={16} />
            <Text style={styles.headlineAmount}>{fmt(totalCents)}</Text>
          </View>
        )}

        <View style={styles.headlineCaption}>
          <Text style={styles.captionMuted}>{hasTarget ? `${progressPct}% funded` : "Total saved"}</Text>
          {netThisMonthCents !== 0 && (
            <>
              <Text style={styles.captionDot}> · </Text>
              <Text style={[styles.captionDelta, { color: monthDeltaColor }]}>{fmtSigned(netThisMonthCents)}</Text>
              <Text style={styles.captionMuted}> this month</Text>
            </>
          )}
        </View>
        {goalPace && (
          <Text style={styles.paceCaption}>
            On pace for {goalPace.completionDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </Text>
        )}

        {fund.is_shared && (
          <View style={styles.heroAvatarRow}>
            <Avatar name="You" size={22} />
            <Avatar name={partnerName ?? "Partner"} size={22} style={styles.heroAvatarOverlap} />
          </View>
        )}

        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={styles.withdrawBtn}
            onPress={() => navigation.navigate("AddFundEntryScreen", { fund, direction: "WITHDRAWAL" })}
            activeOpacity={0.8}
          >
            <Text style={styles.withdrawText}>Withdraw</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate("AddFundEntryScreen", { fund, direction: "CONTRIBUTION" })}
            activeOpacity={0.85}
          >
            <Icon name="plus" type="material-community" size={18} color={COLORS.paper} />
            <Text style={styles.addText}>Contribute</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Trend */}
      {showTrend && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TREND</Text>
          <Surface tier={1} style={styles.trendCard} padding={SIZES.padding * 0.7}>
            <MonthlyTrendChart data={trendPoints} height={160} lineColor={color} countLabel="entries" />
          </Surface>
        </View>
      )}

      {/* Contributors — ranked, tappable, each row drills into that
          person's own trend + activity on FundContributorScreen. */}
      {showSharedBreakdown && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CONTRIBUTORS</Text>
          {contributors.map((c) => {
            const series = monthlySeriesForContributor(entries, c.id);
            const pct = contributorsTotal > 0 ? Math.round((c.total / contributorsTotal) * 100) : 0;
            return (
              <TouchableOpacity
                key={c.id}
                activeOpacity={0.7}
                onPress={() =>
                  navigation.navigate("FundContributorScreen", {
                    fund,
                    contributorId: c.id,
                    contributorName: c.name,
                  })
                }
              >
                <Surface tier={2} style={styles.contributorCard}>
                  <Avatar name={c.name} size={38} />
                  <View style={styles.contributorMid}>
                    <Text style={styles.personName} numberOfLines={1}>{c.name}</Text>
                    <Sparkline data={series} color={avatarColor(c.name)} width={56} height={14} />
                  </View>
                  <View style={styles.contributorRight}>
                    <Text style={styles.personAmount}>{fmt(c.total)}</Text>
                    <Text style={styles.personShare}>{pct}% of total</Text>
                  </View>
                  <Icon name="chevron-right" type="material-community" size={20} color={COLORS.inkSubtle} />
                </Surface>
              </TouchableOpacity>
            );
          })}
          <View style={styles.contributorBarWrap}>
            <View style={styles.bar}>
              <View style={{ flex: Math.max(contributorsTotal > 0 ? myTotal / contributorsTotal : 0.5, 0.02), backgroundColor: avatarColor("You") }} />
              <View style={{ flex: Math.max(contributorsTotal > 0 ? partnerTotal / contributorsTotal : 0.5, 0.02), backgroundColor: avatarColor(partnerName ?? "Partner") }} />
            </View>
          </View>
        </View>
      )}
      {showSoloBreakdown && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CONTRIBUTIONS VS WITHDRAWALS</Text>
          <Surface tier={2} style={styles.breakdownCard}>
            <TwoWayBreakdown
              leftLabel="Contributed"
              leftAmountCents={totalContributedCents}
              leftColor={COLORS.deltaDown}
              rightLabel="Withdrawn"
              rightAmountCents={totalWithdrawnCents}
              rightColor={COLORS.deltaUp}
              styles={styles}
            />
          </Surface>
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
      contributorName={
        fund.is_shared ? (item.contributor_id === me ? "You" : partnerName) : undefined
      }
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
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SIZES.base }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="arrow-left" type="material-community" size={24} color={COLORS.ink} />
        </TouchableOpacity>
        {searching ? (
          <View style={styles.searchBox}>
            <Icon name="magnify" type="material-community" size={18} color={COLORS.inkMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder={`Search ${fund.name} entries`}
              placeholderTextColor={COLORS.inkSubtle}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            <TouchableOpacity onPress={() => { setQuery(""); setSearching(false); }}>
              <Icon name="close" type="material-community" size={18} color={COLORS.inkMuted} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.headerIdentity}>
              <GlyphPlate name={fund.icon_name || "piggy-bank-outline"} type={fund.icon_type} color={color} size={30} radius={10} />
              <Text style={styles.headerName} numberOfLines={1}>{fund.name}</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate("CreateFundScreen", { fundId: fund.id })} style={styles.headerBtn}>
              <Icon name="pencil-outline" type="material-community" size={22} color={COLORS.ink} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSearching(true)} style={styles.headerBtn}>
              <Icon name="magnify" type="material-community" size={24} color={COLORS.ink} />
            </TouchableOpacity>
          </>
        )}
      </View>

      <SectionList
        showsVerticalScrollIndicator={false}
        sections={sections}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={searching ? undefined : renderHeader}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.monthHeader}>{title}</Text>
        )}
        renderItem={renderEntry}
        ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={() => (
          <Text style={styles.emptyText}>
            {query.trim() ? "No matching entries" : "No contributions yet"}
          </Text>
        )}
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
    searchBox: {
      flex: 1, flexDirection: "row", alignItems: "center", gap: SIZES.base,
      backgroundColor: COLORS.surface1, borderRadius: 10, paddingHorizontal: SIZES.base + 2,
    },
    searchInput: { flex: 1, ...FONTS.body3, color: COLORS.ink, paddingVertical: SIZES.base },

    // Sections (shared label treatment across Trend/Overview/Goal Pace/Breakdown/Activity)
    section: { marginHorizontal: SIZES.padding, marginBottom: SIZES.padding },
    // Rendered inside a `section` View (which already carries the
    // horizontal margin) everywhere except the standalone "ACTIVITY"
    // label — that one gets its own margin via `activityHeader` below.
    sectionLabel: {
      ...FONTS.sectionLabel, color: COLORS.inkMuted, textTransform: "uppercase",
      marginBottom: 10,
    },
    activityHeader: {
      marginHorizontal: SIZES.padding,
      marginBottom: SIZES.base + 2,
    },

    // Hero — one focal number (ring or plain headline) + a caption line.
    // Deliberately not a Surface/card: the ring/headline is the visual
    // anchor on its own, the way Statistics' own headline never gets a box.
    heroCard: {
      alignItems: "center",
      marginHorizontal: SIZES.padding,
      marginTop: SIZES.base + 4,
      marginBottom: SIZES.padding,
    },
    ringWrap: { alignItems: "center" },
    ringCenter: { alignItems: "center", justifyContent: "center" },
    ringAmount: { ...FONTS.amountCard, color: COLORS.ink },
    ringCaption: { ...FONTS.caption, color: COLORS.inkMuted, marginTop: 2 },

    headlineWrap: { alignItems: "center", gap: SIZES.base + 4 },
    headlineAmount: { ...FONTS.amountHero, color: COLORS.ink },

    headlineCaption: {
      flexDirection: "row", alignItems: "center", flexWrap: "wrap",
      justifyContent: "center", marginTop: SIZES.base + 6,
    },
    captionMuted: { ...FONTS.bodyS, color: COLORS.inkMuted },
    captionDot: { ...FONTS.bodyS, color: COLORS.inkSubtle },
    captionDelta: { ...FONTS.bodyS, fontFamily: "Roboto-Bold", fontVariant: ["tabular-nums"] },
    paceCaption: { ...FONTS.caption, color: COLORS.inkSubtle, marginTop: 4 },

    heroAvatarRow: { flexDirection: "row", marginTop: SIZES.base + 6 },
    heroAvatarOverlap: { marginLeft: -8, borderWidth: 2, borderColor: COLORS.paper },

    buttonsRow: { flexDirection: "row", gap: SIZES.base + 2, marginTop: SIZES.padding * 0.8, width: "100%" },
    withdrawBtn: {
      flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 12,
      borderRadius: SIZES.radius, borderWidth: 1, borderColor: COLORS.accent,
    },
    withdrawText: { ...FONTS.h4, color: COLORS.accent },
    addBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      paddingVertical: 12, borderRadius: SIZES.radius, backgroundColor: COLORS.accent,
    },
    addText: { ...FONTS.h4, color: COLORS.paper },

    // Trend
    trendCard: { overflow: "hidden" },

    // Breakdown (solo funds only — shared funds use the Contributors rows below)
    breakdownCard: { padding: SIZES.padding * 0.7 },
    bar: { flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden", width: "100%" },
    legendRow: { flexDirection: "row", justifyContent: "space-between", marginTop: SIZES.base + 2, width: "100%" },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { ...FONTS.caption, color: COLORS.inkMuted },

    // Contributors — ranked, tappable rows (shared funds)
    contributorCard: {
      flexDirection: "row", alignItems: "center", gap: SIZES.base + 4,
      padding: SIZES.padding * 0.65, marginBottom: SIZES.base + 2,
    },
    contributorMid: { flex: 1, gap: 5 },
    contributorRight: { alignItems: "flex-end" },
    personName: { ...FONTS.bodyM, fontFamily: "Roboto-Bold", color: COLORS.ink },
    personAmount: { ...FONTS.amountInline, fontSize: 15, color: COLORS.ink },
    personShare: { ...FONTS.caption, color: COLORS.inkMuted, marginTop: 1 },
    contributorBarWrap: { marginTop: SIZES.base - 2, paddingHorizontal: 2 },

    // Activity list
    monthHeader: {
      ...FONTS.sectionLabel, color: COLORS.inkMuted, letterSpacing: 0.6,
      textTransform: "uppercase", paddingHorizontal: SIZES.padding,
      paddingTop: SIZES.padding * 0.6, paddingBottom: SIZES.base,
      backgroundColor: COLORS.paper,
    },
    listContent: { paddingBottom: SIZES.padding },
    rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.hairline, marginHorizontal: SIZES.padding },
    cardRow: { flexDirection: "row", alignItems: "center", paddingVertical: SIZES.base + 2, paddingHorizontal: SIZES.padding, gap: 12 },
    avatarBadgeWrap: { width: 42, height: 42 },
    directionBadge: {
      position: "absolute", right: -2, bottom: -2,
      width: 16, height: 16, borderRadius: 8, borderWidth: 1.5,
      alignItems: "center", justifyContent: "center",
    },
    cardInfo: { flex: 1 },
    descText: { ...FONTS.bodyM, fontFamily: "Roboto-Bold", color: COLORS.ink },
    dateText: { ...FONTS.caption, color: COLORS.inkMuted, marginTop: 2 },
    amountText: { ...FONTS.amountInline, fontSize: 16 },

    emptyText: { textAlign: "center", marginTop: 30, ...FONTS.body3, color: COLORS.inkMuted },
  });

export default FundDetailScreen;

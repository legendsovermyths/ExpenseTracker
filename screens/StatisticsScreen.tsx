import React, { useEffect, useMemo, useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";

import { RADIUS, SPACE } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { useExpensifyStore } from "../store/store";
import { formatCurrency } from "../services/Utils";
import { ensureTransactionsLoadedFrom } from "../services/TransactionWindow";
import { RangeValue, presetRange } from "../components/primitives";
import {
  Amount,
  EmptyState,
  GlyphPlate,
  HeaderIconButton,
  LargeTitle,
  ListRow,
  Pressable,
  RangeChipRail,
  SectionLabel,
  Sparkline,
  Text,
} from "../components/ui";
import {
  rangeShape,
  priorWindow,
  priorPhrase,
  compactHeadline,
  daysBetween,
} from "../services/AnalysisCopy";
import { Transaction } from "../types/entity/Transaction";
import { Category } from "../types/entity/Category";
import { Donut, ShareBar, LineChart } from "../components/charts";

import { useCurrency } from "../constants/currency";
// ─────────────────────────────────────────────────────────────────────
// Data helpers (range-agnostic)
// ─────────────────────────────────────────────────────────────────────

const startOf = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);

const inRange = (t: Transaction, start: Date, end: Date) => {
  const td = startOf(new Date(t.date_time)).getTime();
  return td >= start.getTime() && td <= end.getTime();
};

const dailySpend = (
  transactions: Transaction[],
  start: Date,
  end: Date,
): number[] => {
  const days = daysBetween(start, end);
  const out = new Array(days).fill(0);
  transactions.forEach((t) => {
    if (t.is_credit) return;
    if (!inRange(t, start, end)) return;
    const d = startOf(new Date(t.date_time));
    const idx = Math.round((d.getTime() - start.getTime()) / (86400 * 1000));
    if (idx >= 0 && idx < days) out[idx] += t.amount;
  });
  return out;
};

interface CategoryRow {
  catId: number;
  category: Category;
  amount: number;
  priorAmount: number;
  share: number; // 0–1, of period total
  daily: number[]; // for sparkline
}

const buildCategoryRows = (
  txns: Transaction[],
  priorTxns: Transaction[],
  start: Date,
  end: Date,
  categoriesById: Record<number, Category>,
): CategoryRow[] => {
  const sums: Record<number, number> = {};
  const priorSums: Record<number, number> = {};
  txns.forEach((t) => {
    if (t.is_credit) return;
    sums[t.category_id] = (sums[t.category_id] || 0) + t.amount;
  });
  priorTxns.forEach((t) => {
    if (t.is_credit) return;
    priorSums[t.category_id] = (priorSums[t.category_id] || 0) + t.amount;
  });

  const total = Object.values(sums).reduce((a, b) => a + b, 0);
  const rows: CategoryRow[] = Object.entries(sums)
    .map(([k, amount]) => {
      const catId = Number(k);
      const category = categoriesById[catId];
      if (!category) return null;
      const catTxns = txns.filter(
        (t) => t.category_id === catId && !t.is_credit,
      );
      return {
        catId,
        category,
        amount,
        priorAmount: priorSums[catId] || 0,
        share: total > 0 ? amount / total : 0,
        daily: dailySpend(catTxns, start, end),
      } as CategoryRow;
    })
    .filter((r): r is CategoryRow => r !== null)
    .sort((a, b) => b.amount - a.amount);

  return rows;
};

// ── Range-agnostic insight engine ─────────────────────────────────────
type InsightTone = "warn" | "pattern" | "milestone" | "fun";
interface Insight {
  icon: string;
  text: string;
  tone: InsightTone;
}

const generateInsights = (
  current: Transaction[],
  prior: Transaction[],
  start: Date,
  end: Date,
  categoriesById: Record<number, Category>,
  shapeWord: string,
): Insight[] => {
  const out: Insight[] = [];
  const debits = current.filter((t) => !t.is_credit);
  const priorDebits = prior.filter((t) => !t.is_credit);
  if (debits.length === 0) return out;

  const total = debits.reduce((a, t) => a + t.amount, 0);
  const priorTotal = priorDebits.reduce((a, t) => a + t.amount, 0);

  // Category swing — biggest mover vs prior period
  const cats: Record<number, number> = {};
  const priorCats: Record<number, number> = {};
  debits.forEach((t) => {
    cats[t.category_id] = (cats[t.category_id] || 0) + t.amount;
  });
  priorDebits.forEach((t) => {
    priorCats[t.category_id] = (priorCats[t.category_id] || 0) + t.amount;
  });

  let topUp: { id: number; pct: number } | null = null;
  let topDown: { id: number; pct: number } | null = null;
  for (const [id, amt] of Object.entries(cats)) {
    const p = priorCats[Number(id)] || 0;
    if (p > 0) {
      const pct = Math.round(((amt - p) / p) * 100);
      if (pct >= 30 && (!topUp || pct > topUp.pct))
        topUp = { id: Number(id), pct };
      if (pct <= -30 && (!topDown || pct < topDown.pct))
        topDown = { id: Number(id), pct };
    }
  }
  if (topUp && categoriesById[topUp.id]) {
    out.push({
      icon: "trending-up",
      text: `${categoriesById[topUp.id].name} is up ${topUp.pct}% vs ${shapeWord}`,
      tone: "warn",
    });
  }
  if (topDown && categoriesById[topDown.id]) {
    out.push({
      icon: "trending-down",
      text: `${categoriesById[topDown.id].name} is down ${Math.abs(topDown.pct)}% vs ${shapeWord}`,
      tone: "milestone",
    });
  }

  // Concentration
  const sorted = Object.values(cats).sort((a, b) => b - a);
  if (sorted.length >= 2 && total > 0) {
    const top2 = sorted.slice(0, 2).reduce((a, b) => a + b, 0);
    const pct = Math.round((top2 / total) * 100);
    if (pct >= 70) {
      out.push({
        icon: "target",
        text: `${pct}% of spending sits in 2 categories`,
        tone: "pattern",
      });
    }
  }

  // Big day
  const daily = dailySpend(debits, start, end);
  const max = Math.max(...daily);
  if (max > 0 && total > 0) {
    const maxIdx = daily.indexOf(max);
    const maxDate = new Date(start);
    maxDate.setDate(maxDate.getDate() + maxIdx);
    const share = Math.round((max / total) * 100);
    if (share >= 15) {
      const m = [
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
      out.push({
        icon: "chart-bar",
        text: `${m[maxDate.getMonth()]} ${maxDate.getDate()} alone was ${share}% of the period`,
        tone: "pattern",
      });
    }
  }

  // Recurring vendor
  const descCounts: Record<string, number> = {};
  debits.forEach((t) => {
    const d = (t.description || "").trim();
    if (d) descCounts[d] = (descCounts[d] || 0) + 1;
  });
  const topVendor = Object.entries(descCounts).sort(([, a], [, b]) => b - a)[0];
  if (topVendor && topVendor[1] >= 3) {
    out.push({
      icon: "repeat",
      text: `${topVendor[0]} appears ${topVendor[1]} times`,
      tone: "pattern",
    });
  }

  // New vendors
  if (priorDebits.length > 0) {
    const priorVendors = new Set(
      priorDebits
        .map((t) => (t.description || "").trim().toLowerCase())
        .filter(Boolean),
    );
    const newVendors = new Set(
      debits
        .map((t) => (t.description || "").trim().toLowerCase())
        .filter((d) => d && !priorVendors.has(d)),
    );
    if (newVendors.size >= 2) {
      out.push({
        icon: "store-plus-outline",
        text: `${newVendors.size} new vendors this period`,
        tone: "fun",
      });
    }
  }

  // Average transaction
  if (debits.length >= 2) {
    const avg = total / debits.length;
    out.push({
      icon: "calculator-variant-outline",
      text: `Avg transaction ${formatCurrency(avg, false)}`,
      tone: "fun",
    });
  }

  // Weekend vs weekday tilt
  if (debits.length >= 4) {
    let wd = 0,
      we = 0,
      wdc = 0,
      wec = 0;
    debits.forEach((t) => {
      const dow = new Date(t.date_time).getDay();
      if (dow === 0 || dow === 6) {
        we += t.amount;
        wec++;
      } else {
        wd += t.amount;
        wdc++;
      }
    });
    if (wdc > 0 && wec > 0) {
      const wdAvg = wd / wdc;
      const weAvg = we / wec;
      const ratio = weAvg / wdAvg;
      if (ratio >= 1.3) {
        out.push({
          icon: "beach",
          text: `Weekend transactions average ${ratio.toFixed(1)}× weekdays`,
          tone: "pattern",
        });
      } else if (ratio <= 0.7 && ratio > 0) {
        out.push({
          icon: "briefcase-outline",
          text: `Weekday transactions average ${(1 / ratio).toFixed(1)}× weekends`,
          tone: "pattern",
        });
      }
    }
  }

  // Overall vs prior
  if (priorTotal > 0) {
    const swing = Math.round(((total - priorTotal) / priorTotal) * 100);
    if (Math.abs(swing) >= 25) {
      out.push({
        icon: swing > 0 ? "alert-circle-outline" : "party-popper",
        text:
          swing > 0
            ? `Total spending is ${swing}% higher than ${shapeWord}`
            : `Total spending is ${Math.abs(swing)}% lower than ${shapeWord}`,
        tone: swing > 0 ? "warn" : "milestone",
      });
    }
  }

  return out;
};

// Prior period stretched onto the current period's length so the two
// lines share an x-axis (e.g. a 31-day month against a 30-day one).
const resample = (data: number[], len: number): number[] => {
  if (data.length === 0 || len === 0) return [];
  if (data.length === len) return data;
  return Array.from(
    { length: len },
    (_, i) => data[Math.round((i / Math.max(len - 1, 1)) * (data.length - 1))],
  );
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
const dayLabel = (start: Date, i: number) => {
  const d = new Date(start);
  d.setDate(d.getDate() + i);
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
};

// ─────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────

// Stable category color: hash by category id into the categorical palette.
// Same category always gets the same color across donut, bars, dashboard.
const colorForCategory = (
  catId: number,
  palette: readonly string[],
): string => {
  const idx = Math.abs(catId) % palette.length;
  return palette[idx];
};

const StatsScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const currency = useCurrency();

  const navigation = useNavigation<any>();

  const transactionsById = useExpensifyStore((s) => s.transactions);
  const categoriesById = useExpensifyStore((s) => s.categories);
  const accountsById = useExpensifyStore((s) => s.accounts);
  const allTxns = Object.values(transactionsById);

  // Follows the month selected on the Transactions screen.
  const selectedMonth = useExpensifyStore((s) => s.selectedMonth);
  const monthRangeFor = (ref: { year: number; month: number }): RangeValue => {
    const r = presetRange("month", undefined, undefined, ref);
    return { key: "month", start: r.start, end: r.end };
  };

  const [range, setRange] = useState<RangeValue>(() =>
    monthRangeFor(selectedMonth),
  );

  // Whenever the Transactions month changes, snap Analysis back to the
  // "Month" preset for that month (skip the initial mount — handled above).
  const isFirstMonthSync = React.useRef(true);
  useEffect(() => {
    if (isFirstMonthSync.current) {
      isFirstMonthSync.current = false;
      return;
    }
    setRange(monthRangeFor(selectedMonth));
  }, [selectedMonth]);
  const [compare, setCompare] = useState(false);
  const [selectedSlice, setSelectedSlice] = useState<number | null>(null);
  useEffect(() => setSelectedSlice(null), [range]);

  const shape = useMemo(() => rangeShape(range.start, range.end), [range]);
  const { priorStart, priorEnd } = useMemo(
    () => priorWindow(range.start, range.end),
    [range],
  );
  const shapeWord = useMemo(() => priorPhrase(shape), [shape]);

  // Defensive — only fires if the user picks a period older than the
  // 6-month hot window (default "this month" view never triggers it).
  useEffect(() => {
    ensureTransactionsLoadedFrom(priorStart);
  }, [priorStart]);

  const currentTxns = useMemo(
    () => allTxns.filter((t) => inRange(t, range.start, range.end)),
    [allTxns, range],
  );
  const priorTxns = useMemo(
    () => allTxns.filter((t) => inRange(t, priorStart, priorEnd)),
    [allTxns, priorStart, priorEnd],
  );

  const totalSpent = useMemo(
    () =>
      currentTxns.filter((t) => !t.is_credit).reduce((a, t) => a + t.amount, 0),
    [currentTxns],
  );
  const priorSpent = useMemo(
    () =>
      priorTxns.filter((t) => !t.is_credit).reduce((a, t) => a + t.amount, 0),
    [priorTxns],
  );

  const headline = useMemo(
    () => compactHeadline(shape, totalSpent, priorSpent),
    // Copy embeds the currency symbol, so recompute when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shape, totalSpent, priorSpent, currency],
  );

  const categoryRows = useMemo(
    () =>
      buildCategoryRows(
        currentTxns,
        priorTxns,
        range.start,
        range.end,
        categoriesById,
      ),
    [currentTxns, priorTxns, range, categoriesById],
  );

  const insights = useMemo(
    () =>
      generateInsights(
        currentTxns,
        priorTxns,
        range.start,
        range.end,
        categoriesById,
        shapeWord,
      ),
    // Copy embeds the currency symbol, so recompute when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentTxns, priorTxns, range, categoriesById, shapeWord, currency],
  );

  const dailyCurrent = useMemo(
    () => dailySpend(currentTxns, range.start, range.end),
    [currentTxns, range],
  );
  const dailyPrior = useMemo(
    () => dailySpend(priorTxns, priorStart, priorEnd),
    [priorTxns, priorStart, priorEnd],
  );

  const topTransactions = useMemo(() => {
    return currentTxns
      .filter((t) => !t.is_credit)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [currentTxns]);

  const hasData = currentTxns.length > 0;

  const goToCategory = (row: CategoryRow) => {
    navigation.navigate("SubcategoryStat", {
      category: row.category,
      percentage: Number((row.share * 100).toFixed(1)),
      startDate: range.start.toISOString(),
      endDate: range.end.toISOString(),
    });
  };

  const enter = (i: number) => FadeInDown.delay(60 + i * 50).duration(320);
  let section = 0;

  const insightColor = (tone: InsightTone) =>
    tone === "warn"
      ? COLORS.deltaUp
      : tone === "milestone"
        ? COLORS.deltaDown
        : tone === "pattern"
          ? COLORS.accent
          : COLORS.inkMuted;

  return (
    <View style={[styles.container, { backgroundColor: COLORS.paper }]}>
      <LargeTitle
        title="Analysis"
        right={
          <HeaderIconButton
            icon="swap-horizontal"
            label={compare ? "Hide comparison" : "Compare with prior period"}
            tone={compare ? "accent" : "ink"}
            onPress={() => setCompare((v) => !v)}
          />
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Headline — the number is the hero */}
        <View style={styles.headline}>
          <Amount
            cents={Math.round(totalSpent * 100)}
            decimals="never"
            variant="display"
            animated
            from={0}
          />
          <Text variant="callout" tone="muted" style={styles.caption}>
            {headline.period}
            {headline.delta && (
              <>
                {"  ·  "}
                <Text
                  variant="callout"
                  tone={headline.delta.tone === "up" ? "up" : "down"}
                >
                  {headline.delta.text}
                </Text>{" "}
                {headline.delta.suffix}
              </>
            )}
          </Text>
        </View>

        <View style={styles.rail}>
          <RangeChipRail
            value={range}
            onChange={setRange}
            referenceMonth={selectedMonth}
          />
        </View>

        {!hasData ? (
          <EmptyState
            icon="chart-arc"
            title="Nothing to analyse"
            message="No transactions in this range."
          />
        ) : (
          <>
            {/* ── Where it went ── */}
            <Animated.View entering={enter(section++)}>
              <SectionLabel title="Where it went" />
              {categoryRows.length > 0 && (
                <Donut
                  segments={categoryRows.map((row) => ({
                    value: row.amount,
                    color: colorForCategory(row.catId, COLORS.ordinal),
                    label: row.category.name,
                  }))}
                  selected={selectedSlice}
                  onSelect={setSelectedSlice}
                  style={styles.donut}
                  accessibilityLabel={`Spending split across ${categoryRows.length} categories`}
                  center={(sel) =>
                    sel === null ? (
                      <>
                        <Amount
                          cents={Math.round(totalSpent * 100)}
                          decimals="never"
                          variant="title"
                          animated
                          from={0}
                          style={styles.centerNum}
                        />
                        <Text variant="caption" tone="muted">
                          {categoryRows.length}{" "}
                          {categoryRows.length === 1
                            ? "category"
                            : "categories"}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text variant="caption" tone="muted" numberOfLines={1}>
                          {categoryRows[sel].category.name}
                        </Text>
                        <Amount
                          cents={Math.round(categoryRows[sel].amount * 100)}
                          decimals="never"
                          variant="title"
                          animated
                          style={styles.centerNum}
                        />
                        <Text variant="caption" tone="muted">
                          {Math.round(
                            (categoryRows[sel].amount /
                              Math.max(totalSpent, 1)) *
                              100,
                          )}
                          %
                        </Text>
                      </>
                    )
                  }
                />
              )}

              {categoryRows.map((row, i) => {
                const color = colorForCategory(row.catId, COLORS.ordinal);
                const widthPct = Math.max(row.share * 100, 2);
                const delta =
                  row.priorAmount > 0
                    ? Math.round(
                        ((row.amount - row.priorAmount) / row.priorAmount) *
                          100,
                      )
                    : null;
                return (
                  <Pressable
                    key={row.catId}
                    onPress={() => goToCategory(row)}
                    scale={false}
                    accessibilityRole="button"
                    accessibilityLabel={`${row.category.name}, ${formatCurrency(row.amount, false)}`}
                    style={[
                      styles.catRow,
                      selectedSlice !== null &&
                        selectedSlice < categoryRows.length &&
                        selectedSlice !== i && { opacity: 0.35 },
                      i < categoryRows.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: COLORS.hairline,
                      },
                    ]}
                  >
                    <View style={styles.catTop}>
                      <GlyphPlate
                        name={row.category.icon_name}
                        type={row.category.icon_type}
                        color={color}
                        size={32}
                        radius={9}
                      />
                      <Text
                        variant="headline"
                        numberOfLines={1}
                        style={styles.flex}
                      >
                        {row.category.name}
                      </Text>
                      <Sparkline
                        data={row.daily}
                        width={44}
                        height={14}
                        color={color}
                        strokeWidth={1.25}
                      />
                      {delta !== null && Math.abs(delta) >= 1 && (
                        <Text
                          variant="caption"
                          tone={delta > 0 ? "up" : "down"}
                          style={styles.tabular}
                        >
                          {delta > 0 ? "+" : ""}
                          {delta}%
                        </Text>
                      )}
                      <Amount
                        cents={Math.round(row.amount * 100)}
                        decimals="never"
                        animated
                        from={0}
                        style={styles.rowNum}
                      />
                    </View>
                    <ShareBar
                      value={widthPct / 100}
                      color={color}
                      height={3}
                      style={styles.barTrack}
                    />
                  </Pressable>
                );
              })}
            </Animated.View>

            {/* ── What changed ── */}
            {insights.length > 0 && (
              <Animated.View entering={enter(section++)}>
                <SectionLabel title="What changed" />
                {insights.map((ins, i) => (
                  <View key={i} style={styles.insightRow}>
                    <GlyphPlate
                      name={ins.icon}
                      color={insightColor(ins.tone)}
                      size={30}
                      radius={9}
                    />
                    <Text variant="body" style={styles.flex}>
                      {ins.text}
                    </Text>
                  </View>
                ))}
              </Animated.View>
            )}

            {/* ── Trend ── */}
            <Animated.View entering={enter(section++)}>
              <SectionLabel
                title="Trend"
                right={
                  compare ? (
                    <View style={styles.legend}>
                      <View
                        style={[
                          styles.legendLine,
                          { backgroundColor: COLORS.accent },
                        ]}
                      />
                      <Text variant="caption" tone="muted">
                        This period
                      </Text>
                      <View
                        style={[
                          styles.legendLine,
                          styles.legendPrior,
                          { backgroundColor: COLORS.inkSubtle },
                        ]}
                      />
                      <Text variant="caption" tone="muted">
                        Prior
                      </Text>
                    </View>
                  ) : undefined
                }
              />
              <Text variant="caption" tone="muted">
                Daily spend across the period
              </Text>
              <View style={styles.chart}>
                {dailyCurrent.length >= 2 ? (
                  <LineChart
                    series={[
                      { data: dailyCurrent, color: COLORS.accent },
                      ...(compare
                        ? [
                            {
                              data: resample(dailyPrior, dailyCurrent.length),
                              dashed: true,
                              fill: false,
                              name: "Prior",
                            },
                          ]
                        : []),
                    ]}
                    labels={dailyCurrent.map(
                      (_, i) => dayLabel(range.start, i).split(" ")[0],
                    )}
                    tooltipLabel={(i) => dayLabel(range.start, i)}
                    height={150}
                    maxLabels={6}
                    accessibilityLabel="Daily spend across the period"
                  />
                ) : null}
              </View>
            </Animated.View>

            {/* ── Top transactions ── */}
            {topTransactions.length > 0 && (
              <Animated.View entering={enter(section++)}>
                <SectionLabel title="Top transactions" />
                {topTransactions.map((tx) => {
                  const cat = categoriesById[tx.category_id];
                  return (
                    <ListRow
                      key={tx.id}
                      padded={false}
                      leading={
                        cat ? (
                          <GlyphPlate
                            name={cat.icon_name}
                            type={cat.icon_type}
                            color={colorForCategory(
                              tx.category_id,
                              COLORS.ordinal,
                            )}
                            size={36}
                            radius={10}
                          />
                        ) : undefined
                      }
                      title={tx.description || cat?.name || "Untitled"}
                      subtitle={accountsById[tx.account_id]?.name || undefined}
                      trailing={
                        <Amount
                          cents={Math.round(tx.amount * 100)}
                          decimals="never"
                        />
                      }
                    />
                  );
                })}
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  centerNum: { textAlign: "center" },
  rowNum: { textAlign: "right" },
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACE.gutter, paddingBottom: 120 },
  flex: { flex: 1 },
  tabular: { fontVariant: ["tabular-nums"] },
  headline: { paddingTop: SPACE.sm, paddingBottom: SPACE.lg },
  caption: { marginTop: SPACE.xs },
  rail: { marginHorizontal: -SPACE.xs, marginBottom: SPACE.sm },
  donut: {
    alignItems: "center",
    paddingTop: SPACE.sm,
    paddingBottom: SPACE.xl,
  },
  donutCenter: { alignItems: "center", justifyContent: "center" },
  catRow: { paddingVertical: SPACE.md },
  catTop: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  barTrack: { marginTop: SPACE.sm },
  insightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    paddingVertical: SPACE.sm,
  },
  chart: { marginTop: SPACE.md },
  legend: { flexDirection: "row", alignItems: "center", gap: SPACE.xs + 2 },
  legendLine: { width: 10, height: 2, borderRadius: RADIUS.pill },
  legendPrior: { opacity: 0.5, marginLeft: SPACE.sm },
});

export default StatsScreen;

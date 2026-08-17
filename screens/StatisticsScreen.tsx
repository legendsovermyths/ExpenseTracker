import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { PieChart } from "react-native-gifted-charts";
import { Icon } from "react-native-elements";
import { useNavigation } from "@react-navigation/native";

import { FONTS, SIZES } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";
import { useExpensifyStore } from "../store/store";
import { formatAmountWithCommas } from "../services/Utils";
import { ensureTransactionsLoadedFrom } from "../services/TransactionWindow";
import {
  Surface,
  GlyphPlate,
  Sparkline,
  RangeChipRail,
  RangeValue,
  presetRange,
} from "../components/primitives";
import {
  rangeShape,
  priorWindow,
  priorPhrase,
  compactHeadline,
  daysBetween,
} from "../services/AnalysisCopy";
import { Transaction } from "../types/entity/Transaction";
import { Category } from "../types/entity/Category";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─────────────────────────────────────────────────────────────────────
// Data helpers (range-agnostic)
// ─────────────────────────────────────────────────────────────────────

const startOf = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);

const inRange = (t: Transaction, start: Date, end: Date) => {
  const td = startOf(new Date(t.date_time)).getTime();
  return td >= start.getTime() && td <= end.getTime();
};

const dailySpend = (transactions: Transaction[], start: Date, end: Date): number[] => {
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
  share: number;          // 0–1, of period total
  daily: number[];        // for sparkline
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
      const catTxns = txns.filter((t) => t.category_id === catId && !t.is_credit);
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
  debits.forEach((t) => { cats[t.category_id] = (cats[t.category_id] || 0) + t.amount; });
  priorDebits.forEach((t) => { priorCats[t.category_id] = (priorCats[t.category_id] || 0) + t.amount; });

  let topUp: { id: number; pct: number } | null = null;
  let topDown: { id: number; pct: number } | null = null;
  for (const [id, amt] of Object.entries(cats)) {
    const p = priorCats[Number(id)] || 0;
    if (p > 0) {
      const pct = Math.round(((amt - p) / p) * 100);
      if (pct >= 30 && (!topUp || pct > topUp.pct)) topUp = { id: Number(id), pct };
      if (pct <= -30 && (!topDown || pct < topDown.pct)) topDown = { id: Number(id), pct };
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
      out.push({ icon: "target", text: `${pct}% of spending sits in 2 categories`, tone: "pattern" });
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
      const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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
    const priorVendors = new Set(priorDebits.map((t) => (t.description || "").trim().toLowerCase()).filter(Boolean));
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
      text: `Avg transaction ₹${formatAmountWithCommas(avg, false)}`,
      tone: "fun",
    });
  }

  // Weekend vs weekday tilt
  if (debits.length >= 4) {
    let wd = 0, we = 0, wdc = 0, wec = 0;
    debits.forEach((t) => {
      const dow = new Date(t.date_time).getDay();
      if (dow === 0 || dow === 6) { we += t.amount; wec++; }
      else { wd += t.amount; wdc++; }
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
        text: swing > 0
          ? `Total spending is ${swing}% higher than ${shapeWord}`
          : `Total spending is ${Math.abs(swing)}% lower than ${shapeWord}`,
        tone: swing > 0 ? "warn" : "milestone",
      });
    }
  }

  return out;
};

// ─────────────────────────────────────────────────────────────────────
// Trend chart — daily totals with optional ghost overlay
// ─────────────────────────────────────────────────────────────────────

interface TrendChartProps {
  current: number[];
  prior?: number[];
  height: number;
  width: number;
  COLORS: ColorPalette;
}

const TrendChart: React.FC<TrendChartProps> = ({ current, prior, height, width, COLORS }) => {
  if (current.length < 2) return null;
  const pad = 6;
  const allValues = [...current, ...(prior || [])];
  const max = Math.max(...allValues, 1);

  const buildPath = (data: number[], targetLen: number) => {
    // Stretch shorter prior across same x-range
    const n = data.length;
    if (n < 2) return "";
    const stepX = (width - pad * 2) / (targetLen - 1);
    return data
      .map((v, i) => {
        const xi = (i / (n - 1)) * (targetLen - 1);
        const x = pad + xi * stepX;
        const y = pad + (height - pad * 2) * (1 - v / max);
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  };

  return (
    <Svg width={width} height={height}>
      {prior && prior.length >= 2 && (
        <Path
          d={buildPath(prior, current.length)}
          stroke={COLORS.inkSubtle}
          strokeWidth={1.5}
          strokeOpacity={0.4}
          strokeDasharray="3,4"
          fill="none"
        />
      )}
      <Path
        d={buildPath(current, current.length)}
        stroke={COLORS.ink}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────

// Stable category color: hash by category id into the categorical palette.
// Same category always gets the same color across donut, bars, dashboard.
const colorForCategory = (catId: number, palette: readonly string[]): string => {
  const idx = Math.abs(catId) % palette.length;
  return palette[idx];
};

const StatsScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const navigation = useNavigation<any>();

  const transactionsById = useExpensifyStore((s) => s.transactions);
  const categoriesById = useExpensifyStore((s) => s.categories);
  const accountsById = useExpensifyStore((s) => s.accounts);
  const allTxns = Object.values(transactionsById);

  const initial = useMemo(() => {
    const r = presetRange("month");
    return { key: "month", start: r.start, end: r.end } as RangeValue;
  }, []);

  const [range, setRange] = useState<RangeValue>(initial);
  const [compare, setCompare] = useState(false);

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
    () => currentTxns.filter((t) => !t.is_credit).reduce((a, t) => a + t.amount, 0),
    [currentTxns],
  );
  const priorSpent = useMemo(
    () => priorTxns.filter((t) => !t.is_credit).reduce((a, t) => a + t.amount, 0),
    [priorTxns],
  );

  const headline = useMemo(
    () => compactHeadline(shape, totalSpent, priorSpent),
    [shape, totalSpent, priorSpent],
  );

  const categoryRows = useMemo(
    () => buildCategoryRows(currentTxns, priorTxns, range.start, range.end, categoriesById),
    [currentTxns, priorTxns, range, categoriesById],
  );

  const insights = useMemo(
    () => generateInsights(currentTxns, priorTxns, range.start, range.end, categoriesById, shapeWord),
    [currentTxns, priorTxns, range, categoriesById, shapeWord],
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

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Title row */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>Analysis</Text>
          <TouchableOpacity
            onPress={() => setCompare((v) => !v)}
            style={[
              styles.compareToggle,
              compare && { backgroundColor: COLORS.ink, borderColor: COLORS.ink },
            ]}
          >
            <Icon
              name="swap-horizontal"
              type="material-community"
              size={14}
              color={compare ? COLORS.paper : COLORS.inkMuted}
            />
            <Text style={[styles.compareLabel, { color: compare ? COLORS.paper : COLORS.inkMuted }]}>
              Compare
            </Text>
          </TouchableOpacity>
        </View>

        {/* Compact headline — big amount + tight caption */}
        <View style={styles.headlineWrap}>
          <Text style={styles.headlineAmount}>{headline.amount}</Text>
          <View style={styles.headlineCaption}>
            <Text style={styles.captionPeriod}>{headline.period}</Text>
            {headline.delta && (
              <>
                <Text style={styles.captionDot}> · </Text>
                <Text
                  style={[
                    styles.captionDelta,
                    {
                      color:
                        headline.delta.tone === "up" ? COLORS.deltaUp : COLORS.deltaDown,
                    },
                  ]}
                >
                  {headline.delta.text}
                </Text>
                <Text style={styles.captionSuffix}> {headline.delta.suffix}</Text>
              </>
            )}
          </View>
        </View>

        {/* Period chip rail */}
        <View style={styles.chipRailWrap}>
          <RangeChipRail value={range} onChange={setRange} />
        </View>

        {!hasData ? (
          <View style={styles.emptyState}>
            <Icon name="chart-arc" type="material-community" size={44} color={COLORS.inkSubtle} />
            <Text style={styles.emptyText}>No transactions in this range</Text>
          </View>
        ) : (
          <>
            {/* ── Where it went ── */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>WHERE IT WENT</Text>
              <Surface tier={1} padding={SIZES.padding * 0.6}>
                {/* Distribution donut — slices share ordinal palette with bars below */}
                {categoryRows.length > 0 && (
                  <View style={styles.donutWrap}>
                    <PieChart
                      data={categoryRows.map((row) => ({
                        value: row.amount,
                        color: colorForCategory(row.catId, COLORS.ordinal),
                      }))}
                      donut
                      radius={82}
                      innerRadius={58}
                      innerCircleColor={COLORS.surface1}
                      centerLabelComponent={() => (
                        <View style={styles.donutCenter}>
                          <Text style={styles.donutCenterAmount} numberOfLines={1}>
                            ₹{formatAmountWithCommas(totalSpent, false)}
                          </Text>
                          <Text style={styles.donutCenterLabel}>
                            {categoryRows.length} {categoryRows.length === 1 ? "category" : "categories"}
                          </Text>
                        </View>
                      )}
                    />
                  </View>
                )}

                {/* Divider between donut and bars */}
                {categoryRows.length > 0 && (
                  <View
                    style={{
                      height: StyleSheet.hairlineWidth,
                      backgroundColor: COLORS.hairline,
                      marginBottom: 4,
                    }}
                  />
                )}

                {categoryRows.map((row, i) => {
                  const color = colorForCategory(row.catId, COLORS.ordinal);
                  const widthPct = Math.max(row.share * 100, 2);
                  const delta =
                    row.priorAmount > 0
                      ? Math.round(((row.amount - row.priorAmount) / row.priorAmount) * 100)
                      : null;
                  return (
                    <TouchableOpacity
                      key={row.catId}
                      onPress={() => goToCategory(row)}
                      activeOpacity={0.7}
                      style={[
                        styles.catRow,
                        i < categoryRows.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: COLORS.hairline,
                        },
                      ]}
                    >
                      <View style={styles.catTopRow}>
                        <GlyphPlate
                          name={row.category.icon_name}
                          type={row.category.icon_type}
                          color={color}
                          size={24}
                          radius={7}
                        />
                        <Text style={styles.catName} numberOfLines={1}>
                          {row.category.name}
                        </Text>
                        <Sparkline
                          data={row.daily}
                          width={48}
                          height={14}
                          color={color}
                          strokeWidth={1.25}
                        />
                        {delta !== null && Math.abs(delta) >= 1 && (
                          <Text
                            style={[
                              styles.catDelta,
                              { color: delta > 0 ? COLORS.deltaUp : COLORS.deltaDown },
                            ]}
                          >
                            {delta > 0 ? "+" : ""}{delta}%
                          </Text>
                        )}
                        <Text style={styles.catAmount}>
                          ₹{formatAmountWithCommas(row.amount, false)}
                        </Text>
                      </View>
                      <View style={[styles.catBarTrack, { backgroundColor: COLORS.hairline }]}>
                        <View
                          style={{
                            width: `${widthPct}%` as any,
                            height: "100%",
                            backgroundColor: color,
                            borderRadius: 2,
                          }}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </Surface>
            </View>

            {/* ── What changed ── */}
            {insights.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>WHAT CHANGED</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginHorizontal: -SIZES.padding }}
                  contentContainerStyle={{ paddingHorizontal: SIZES.padding, gap: 10 }}
                >
                  {insights.map((ins, i) => {
                    const toneColor =
                      ins.tone === "warn" ? COLORS.deltaUp :
                      ins.tone === "milestone" ? COLORS.deltaDown :
                      ins.tone === "pattern" ? COLORS.accent :
                      COLORS.inkMuted;
                    return (
                      <Surface
                        key={i}
                        tier={1}
                        style={[styles.insightCard, { borderLeftWidth: 3, borderLeftColor: toneColor }]}
                      >
                        <Icon name={ins.icon} type="material-community" size={18} color={toneColor} />
                        <Text style={styles.insightText}>{ins.text}</Text>
                      </Surface>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* ── Trend ── */}
            <View style={styles.section}>
              <View style={styles.trendHeader}>
                <Text style={styles.sectionLabel}>TREND</Text>
                {compare && (
                  <View style={styles.trendLegend}>
                    <View style={[styles.legendDot, { backgroundColor: COLORS.ink }]} />
                    <Text style={styles.legendLabel}>This period</Text>
                    <View style={[styles.legendDash, { backgroundColor: COLORS.inkSubtle }]} />
                    <Text style={styles.legendLabel}>Prior</Text>
                  </View>
                )}
              </View>
              <Surface tier={1} padding={SIZES.padding * 0.7}>
                <Text style={styles.trendCaption}>Daily spend across the period</Text>
                <View style={{ marginTop: 10, alignItems: "center" }}>
                  <TrendChart
                    current={dailyCurrent}
                    prior={compare ? dailyPrior : undefined}
                    height={120}
                    width={SCREEN_WIDTH - SIZES.padding * 2 - SIZES.padding * 0.7 * 2}
                    COLORS={COLORS}
                  />
                </View>
              </Surface>
            </View>

            {/* ── Top transactions ── */}
            {topTransactions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>TOP TRANSACTIONS</Text>
                <Surface tier={1} padding={SIZES.padding * 0.6}>
                  {topTransactions.map((tx, i) => {
                    const cat = categoriesById[tx.category_id];
                    const color = colorForCategory(tx.category_id, COLORS.ordinal);
                    return (
                      <View
                        key={tx.id}
                        style={[
                          styles.txRow,
                          i < topTransactions.length - 1 && {
                            borderBottomWidth: StyleSheet.hairlineWidth,
                            borderBottomColor: COLORS.hairline,
                          },
                        ]}
                      >
                        {cat && (
                          <GlyphPlate
                            name={cat.icon_name}
                            type={cat.icon_type}
                            color={color}
                            size={32}
                            radius={9}
                          />
                        )}
                        <View style={styles.txInfo}>
                          <Text style={styles.txDesc} numberOfLines={1}>
                            {tx.description || cat?.name || "—"}
                          </Text>
                          <Text style={styles.txAccount}>
                            {accountsById[tx.account_id]?.name || ""}
                          </Text>
                        </View>
                        <Text style={styles.txAmount}>
                          ₹{formatAmountWithCommas(tx.amount, false)}
                        </Text>
                      </View>
                    );
                  })}
                </Surface>
              </View>
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.paper,
    },
    scrollContent: {
      paddingHorizontal: SIZES.padding,
      paddingTop: SIZES.padding * 2.5,
    },
    titleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: SIZES.padding * 0.75,
    },
    title: {
      ...FONTS.screenTitle,
      color: COLORS.ink,
    },
    compareToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.hairline,
      backgroundColor: COLORS.surface2,
    },
    compareLabel: {
      ...FONTS.caption,
      fontSize: 12,
      letterSpacing: 0.3,
    },

    headlineWrap: {
      marginBottom: SIZES.padding * 0.75,
    },
    headlineAmount: {
      ...FONTS.amountHero,
      color: COLORS.ink,
    },
    headlineCaption: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
      flexWrap: "wrap",
    },
    captionPeriod: {
      ...FONTS.bodyS,
      color: COLORS.inkMuted,
      fontWeight: "500",
    },
    captionDot: {
      ...FONTS.bodyS,
      color: COLORS.inkSubtle,
    },
    captionDelta: {
      ...FONTS.bodyS,
      fontFamily: "Roboto-Bold",
      fontVariant: ["tabular-nums"],
    },
    captionSuffix: {
      ...FONTS.bodyS,
      color: COLORS.inkMuted,
    },

    chipRailWrap: {
      marginBottom: SIZES.padding,
      marginHorizontal: -4,
    },

    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: SIZES.padding * 3,
      gap: SIZES.base,
    },
    emptyText: {
      ...FONTS.bodyM,
      color: COLORS.inkMuted,
    },

    section: {
      marginBottom: SIZES.padding,
    },
    sectionLabel: {
      ...FONTS.sectionLabel,
      color: COLORS.inkMuted,
      textTransform: "uppercase",
      marginBottom: 10,
    },

    // ── Donut ───────────────────────────────────────────────────────
    donutWrap: {
      alignItems: "center",
      paddingVertical: 10,
      paddingBottom: 18,
    },
    donutCenter: {
      alignItems: "center",
      justifyContent: "center",
    },
    donutCenterAmount: {
      ...FONTS.amountCard,
      color: COLORS.ink,
    },
    donutCenterLabel: {
      ...FONTS.caption,
      color: COLORS.inkMuted,
      marginTop: 2,
      letterSpacing: 0.3,
    },

    // ── Category rows (compact) ─────────────────────────────────────
    catRow: {
      paddingVertical: 7,
    },
    catTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    catName: {
      ...FONTS.bodyS,
      fontSize: 13,
      color: COLORS.ink,
      flex: 1,
      fontFamily: "Roboto-Bold",
    },
    catAmount: {
      fontSize: 14,
      fontFamily: "Roboto-Bold",
      color: COLORS.ink,
      fontVariant: ["tabular-nums"],
      letterSpacing: -0.1,
    },
    catBarTrack: {
      height: 3,
      borderRadius: 2,
      overflow: "hidden",
      marginTop: 5,
      marginLeft: 32,
    },
    catDelta: {
      fontSize: 11,
      fontFamily: "Roboto-Bold",
      fontVariant: ["tabular-nums"],
    },

    // ── Insights ────────────────────────────────────────────────────
    insightCard: {
      width: 220,
      padding: 14,
      gap: 8,
    },
    insightText: {
      ...FONTS.bodyS,
      fontSize: 13,
      lineHeight: 18,
      color: COLORS.ink,
    },

    // ── Trend ───────────────────────────────────────────────────────
    trendHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    trendLegend: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    legendDot: {
      width: 8,
      height: 2,
      borderRadius: 1,
    },
    legendDash: {
      width: 8,
      height: 2,
      borderRadius: 1,
      opacity: 0.5,
    },
    legendLabel: {
      ...FONTS.caption,
      color: COLORS.inkMuted,
      fontSize: 10,
    },
    trendCaption: {
      ...FONTS.caption,
      color: COLORS.inkMuted,
      letterSpacing: 0.4,
    },

    // ── Top transactions ────────────────────────────────────────────
    txRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      gap: 10,
    },
    txInfo: {
      flex: 1,
    },
    txDesc: {
      ...FONTS.bodyM,
      color: COLORS.ink,
      fontWeight: "500",
    },
    txAccount: {
      ...FONTS.caption,
      color: COLORS.inkMuted,
      marginTop: 1,
    },
    txAmount: {
      ...FONTS.amountInline,
      color: COLORS.ink,
    },
  });

export default StatsScreen;

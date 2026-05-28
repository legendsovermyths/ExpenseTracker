import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { PieChart } from "react-native-gifted-charts";
import { Icon } from "react-native-elements";
import { useNavigation, useRoute } from "@react-navigation/native";

import { FONTS, SIZES } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";
import { useExpensifyStore } from "../store/store";
import {
  getTransactionsGroupedBySubategories,
  getNumberOfSubcategoryTransactionsBetweenDates,
  formatAmountWithCommas,
  getMonthlyTrendForCategory,
} from "../services/Utils";
import MonthlyTrendChart from "../components/MonthlyTrendChart";
import { Surface, GlyphPlate } from "../components/primitives";
import { Transaction } from "../types/entity/Transaction";

// Stable category/subcategory color — same rule as Analysis screen.
const colorForId = (id: number, palette: readonly string[]): string =>
  palette[Math.abs(id) % palette.length];

const formatRange = (start: Date, end: Date): string => {
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${m[start.getMonth()]} ${start.getDate()} → ${m[end.getMonth()]} ${end.getDate()}`;
};

interface SubcategoryRow {
  id: number;                  // subcategory_id || category_id
  label: string;
  sum: number;
  icon_name: string;
  icon_type: string;
  category_id: number | null;
  subcategory_id: number | null;
  share: number;               // 0–1
}

const SubcategoryStatScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const categoryObject = route.params.category;
  const categoryId: number = categoryObject.id;
  const categoryName: string = categoryObject.name;
  const startDate = new Date(route.params.startDate);
  const endDate = new Date(route.params.endDate);
  const edDate = useMemo(() => {
    const d = new Date(endDate);
    d.setDate(endDate.getDate() + 1);
    return d;
  }, [endDate]);

  const transactionsById = useExpensifyStore((s) => s.transactions);
  const categoriesById = useExpensifyStore((s) => s.categories);
  const accountsById = useExpensifyStore((s) => s.accounts);
  const transactions = Object.values(transactionsById);

  const grouped = getTransactionsGroupedBySubategories(
    transactions, categoriesById, startDate, endDate, categoryObject,
  ) as any[];
  const txnCount = getNumberOfSubcategoryTransactionsBetweenDates(
    transactions, startDate, endDate, categoryObject,
  );

  const total: number = grouped.reduce((acc: number, item: any) => acc + item.sum, 0);

  const periodTotal = useMemo(
    () =>
      transactions
        .filter((t) => {
          const d = new Date(t.date_time);
          return !t.is_credit && d >= startDate && d < edDate;
        })
        .reduce((acc, t) => acc + t.amount, 0),
    [transactions, startDate, edDate],
  );
  const sharePct = periodTotal > 0 ? Math.round((total / periodTotal) * 100) : 0;

  const subcategoryRows: SubcategoryRow[] = useMemo(() => {
    return grouped
      .map((item) => ({
        id: item.subcategory_id ?? item.category_id ?? 0,
        label: item.label,
        sum: item.sum,
        icon_name: item.icon_name,
        icon_type: item.icon_type,
        category_id: item.category_id,
        subcategory_id: item.subcategory_id,
        share: total > 0 ? item.sum / total : 0,
      }))
      .sort((a, b) => b.sum - a.sum);
  }, [grouped, total]);

  const topTransactions: Transaction[] = useMemo(() => {
    return transactions
      .filter((t) => {
        const d = new Date(t.date_time);
        return !t.is_credit && d >= startDate && d < edDate && t.category_id === categoryId;
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [transactions, startDate, edDate, categoryId]);

  const monthlyTrendData = useMemo(
    () => getMonthlyTrendForCategory(transactions, categoryObject, 12),
    [transactions, categoryObject],
  );

  const headerColor = colorForId(categoryId, COLORS.ordinal);

  const goToAllTransactions = () => {
    navigation.navigate("FilteredTransaction", {
      filter: {
        label: categoryName,
        startDate: startDate.toISOString(),
        endDate: edDate.toISOString(),
        categoryIds: [categoryId],
      },
    });
  };

  const goToSubcategory = (row: SubcategoryRow) => {
    navigation.navigate("FilteredTransaction", {
      filter: {
        label: row.label,
        startDate: startDate.toISOString(),
        endDate: edDate.toISOString(),
        categoryIds: row.category_id ? [row.category_id] : null,
        subcategoryIds: row.subcategory_id ? [row.subcategory_id] : null,
      },
    });
  };

  const hasData = txnCount > 0;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Header row ── */}
        <View style={styles.topRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.backButton}
          >
            <Icon name="arrow-left" type="material-community" size={24} color={COLORS.ink} />
          </TouchableOpacity>
        </View>

        {/* ── Identity block ── */}
        <View style={styles.identityRow}>
          <GlyphPlate
            name={categoryObject.icon_name}
            type={categoryObject.icon_type}
            color={headerColor}
            size={40}
            radius={11}
          />
          <View style={styles.identityText}>
            <Text style={styles.identityName} numberOfLines={1}>{categoryName}</Text>
            <Text style={styles.identitySub}>{formatRange(startDate, endDate)}</Text>
          </View>
        </View>

        {/* ── Compact headline ── */}
        <View style={styles.headlineWrap}>
          <Text style={styles.headlineAmount}>
            ₹{formatAmountWithCommas(total, false)}
          </Text>
          <View style={styles.headlineCaption}>
            <Text style={styles.captionPeriod}>{sharePct}% of period</Text>
            <Text style={styles.captionDot}> · </Text>
            <Text style={styles.captionPeriod}>
              {txnCount} {txnCount === 1 ? "transaction" : "transactions"}
            </Text>
          </View>
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
                {subcategoryRows.length > 0 && (
                  <View style={styles.donutWrap}>
                    <PieChart
                      data={subcategoryRows.map((row) => ({
                        value: row.sum,
                        color: colorForId(row.id, COLORS.ordinal),
                      }))}
                      donut
                      radius={82}
                      innerRadius={58}
                      innerCircleColor={COLORS.surface1}
                      centerLabelComponent={() => (
                        <View style={styles.donutCenter}>
                          <Text style={styles.donutCenterAmount} numberOfLines={1}>
                            ₹{formatAmountWithCommas(total, false)}
                          </Text>
                          <Text style={styles.donutCenterLabel}>
                            {subcategoryRows.length} {subcategoryRows.length === 1 ? "subcategory" : "subcategories"}
                          </Text>
                        </View>
                      )}
                    />
                  </View>
                )}

                {subcategoryRows.length > 0 && (
                  <View
                    style={{
                      height: StyleSheet.hairlineWidth,
                      backgroundColor: COLORS.hairline,
                      marginBottom: 4,
                    }}
                  />
                )}

                {subcategoryRows.map((row, i) => {
                  const color = colorForId(row.id, COLORS.ordinal);
                  const widthPct = Math.max(row.share * 100, 2);
                  return (
                    <TouchableOpacity
                      key={`${row.id}-${i}`}
                      onPress={() => goToSubcategory(row)}
                      activeOpacity={0.7}
                      style={[
                        styles.catRow,
                        i < subcategoryRows.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: COLORS.hairline,
                        },
                      ]}
                    >
                      <View style={styles.catTopRow}>
                        <GlyphPlate
                          name={row.icon_name}
                          type={row.icon_type}
                          color={color}
                          size={24}
                          radius={7}
                        />
                        <Text style={styles.catName} numberOfLines={1}>
                          {row.label}
                        </Text>
                        <Text style={styles.catShare}>
                          {Math.round(row.share * 100)}%
                        </Text>
                        <Text style={styles.catAmount}>
                          ₹{formatAmountWithCommas(row.sum, false)}
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

            {/* ── Monthly trend ── */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>MONTHLY TREND</Text>
              <Surface tier={1} padding={SIZES.padding * 0.7}>
                <Text style={styles.trendCaption}>Last 12 months</Text>
                <View style={{ marginTop: 8 }}>
                  <MonthlyTrendChart data={monthlyTrendData} height={160} />
                </View>
              </Surface>
            </View>

            {/* ── Top transactions ── */}
            {topTransactions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>TOP TRANSACTIONS</Text>
                <Surface tier={1} padding={SIZES.padding * 0.6}>
                  {topTransactions.map((tx, i) => (
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
                      <GlyphPlate
                        name={categoryObject.icon_name}
                        type={categoryObject.icon_type}
                        color={headerColor}
                        size={28}
                        radius={8}
                      />
                      <View style={styles.txInfo}>
                        <Text style={styles.txDesc} numberOfLines={1}>
                          {tx.description || categoryName}
                        </Text>
                        <Text style={styles.txAccount}>
                          {accountsById[tx.account_id]?.name || ""}
                        </Text>
                      </View>
                      <Text style={styles.txAmount}>
                        ₹{formatAmountWithCommas(tx.amount, false)}
                      </Text>
                    </View>
                  ))}
                </Surface>
              </View>
            )}

            {/* ── View all ── */}
            <TouchableOpacity
              onPress={goToAllTransactions}
              activeOpacity={0.7}
              style={styles.viewAllButton}
            >
              <Text style={styles.viewAllText}>
                View all {txnCount} transactions
              </Text>
              <Icon
                name="chevron-right"
                type="material-community"
                size={18}
                color={COLORS.inkMuted}
              />
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
};

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.paper,
    },
    scrollContent: {
      paddingHorizontal: SIZES.padding,
      paddingTop: SIZES.padding * 2,
    },
    topRow: {
      marginBottom: SIZES.padding * 0.5,
    },
    backButton: {
      width: 36,
      height: 36,
      marginLeft: -8,
      alignItems: "center",
      justifyContent: "center",
    },

    // Identity block
    identityRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: SIZES.padding * 0.75,
    },
    identityText: {
      flex: 1,
    },
    identityName: {
      ...FONTS.screenTitle,
      color: COLORS.ink,
    },
    identitySub: {
      ...FONTS.caption,
      color: COLORS.inkMuted,
      marginTop: 2,
      letterSpacing: 0.3,
    },

    // Compact headline
    headlineWrap: {
      marginBottom: SIZES.padding,
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

    // Donut
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

    // Subcategory rows (compact)
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
    catShare: {
      fontSize: 11,
      fontFamily: "Roboto-Bold",
      fontVariant: ["tabular-nums"],
      color: COLORS.inkMuted,
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

    // Trend
    trendCaption: {
      ...FONTS.caption,
      color: COLORS.inkMuted,
      letterSpacing: 0.4,
    },

    // Top transactions
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

    // View all button
    viewAllButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      gap: 4,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.hairline,
      backgroundColor: COLORS.surface2,
      marginTop: -SIZES.padding * 0.5,
    },
    viewAllText: {
      ...FONTS.bodyM,
      color: COLORS.ink,
      fontWeight: "500",
    },
  });

export default SubcategoryStatScreen;

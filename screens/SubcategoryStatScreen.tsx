import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Donut, ShareBar } from "../components/charts";
import { useNavigation, useRoute } from "@react-navigation/native";

import { SPACE } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { useExpensifyStore } from "../store/store";
import {
  getTransactionsGroupedBySubategories,
  getNumberOfSubcategoryTransactionsBetweenDates,
  formatAmountWithCommas,
  getMonthlyTrendForCategory,
} from "../services/Utils";
import MonthlyTrendChart from "../components/MonthlyTrendChart";
import {
  Amount,
  DetailHero,
  EmptyState,
  GlyphPlate,
  ListRow,
  Page,
  Pressable,
  RowGroup,
  SectionLabel,
  Text,
} from "../components/ui";
import { Transaction } from "../types/entity/Transaction";
import { ensureTransactionsLoadedFrom } from "../services/TransactionWindow";

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

  // The 12-month trend and/or the passed-in range can reach further back
  // than the 6-month hot window — pull in older batches if needed.
  useEffect(() => {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    const earliestNeeded = startDate < twelveMonthsAgo ? startDate : twelveMonthsAgo;
    ensureTransactionsLoadedFrom(earliestNeeded);
  }, [startDate]);

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

  const [selectedSlice, setSelectedSlice] = useState<number | null>(null);
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

  const enter = (i: number) => FadeInDown.delay(60 + i * 50).duration(320);
  let section = 0;

  return (
    <Page
      title={categoryName}
      hero={
        <DetailHero
          icon={categoryObject.icon_name}
          iconType={categoryObject.icon_type}
          iconColor={headerColor}
          title={categoryName}
          meta={formatRange(startDate, endDate)}
          amountCents={Math.round(total * 100)}
          caption={`${sharePct}% of period  ·  ${txnCount} ${txnCount === 1 ? "transaction" : "transactions"}`}
        />
      }
    >
      {!hasData ? (
        <EmptyState icon="chart-arc" title="Nothing here yet" message="No transactions in this range." />
      ) : (
        <>
          {/* ── Where it went ── */}
          <Animated.View entering={enter(section++)}>
            <SectionLabel title="Where it went" />
            {subcategoryRows.length > 0 && (
              <Donut
                segments={subcategoryRows.map((row) => ({ value: row.sum, color: colorForId(row.id, COLORS.ordinal), label: row.label }))}
                selected={selectedSlice}
                onSelect={setSelectedSlice}
                style={styles.donut}
                accessibilityLabel={`Spending split across ${subcategoryRows.length} subcategories`}
                center={(sel) =>
                  sel === null ? (
                    <>
                      <Amount cents={Math.round(total * 100)} decimals="never" variant="title" />
                      <Text variant="caption" tone="muted">
                        {subcategoryRows.length} {subcategoryRows.length === 1 ? "subcategory" : "subcategories"}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text variant="caption" tone="muted" numberOfLines={1}>
                        {subcategoryRows[sel].label}
                      </Text>
                      <Amount cents={Math.round(subcategoryRows[sel].sum * 100)} decimals="never" variant="title" />
                      <Text variant="caption" tone="muted">
                        {Math.round((subcategoryRows[sel].sum / Math.max(total, 1)) * 100)}%
                      </Text>
                    </>
                  )
                }
              />
            )}

            {subcategoryRows.map((row, i) => {
              const color = colorForId(row.id, COLORS.ordinal);
              const widthPct = Math.max(row.share * 100, 2);
              return (
                <Pressable
                  key={`${row.id}-${i}`}
                  onPress={() => goToSubcategory(row)}
                  scale={false}
                  accessibilityRole="button"
                  accessibilityLabel={`${row.label}, ₹${formatAmountWithCommas(row.sum, false)}`}
                  style={[
                    styles.catRow,
                    selectedSlice !== null && selectedSlice < subcategoryRows.length && selectedSlice !== i && { opacity: 0.35 },
                    i < subcategoryRows.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: COLORS.hairline,
                    },
                  ]}
                >
                  <View style={styles.catTop}>
                    <GlyphPlate name={row.icon_name} type={row.icon_type} color={color} size={32} radius={9} />
                    <Text variant="headline" numberOfLines={1} style={styles.flex}>
                      {row.label}
                    </Text>
                    <Text variant="caption" tone="muted" style={styles.tabular}>
                      {Math.round(row.share * 100)}%
                    </Text>
                    <Amount cents={Math.round(row.sum * 100)} decimals="never" />
                  </View>
                  <ShareBar value={widthPct / 100} color={color} height={3} style={styles.barTrack} />
                </Pressable>
              );
            })}
          </Animated.View>

          {/* ── Monthly trend ── */}
          <Animated.View entering={enter(section++)}>
            <SectionLabel
              title="Monthly trend"
              right={
                <Text variant="caption" tone="subtle">
                  Last 12 months
                </Text>
              }
            />
            <MonthlyTrendChart data={monthlyTrendData} height={160} lineColor={headerColor} />
          </Animated.View>

          {/* ── Top transactions ── */}
          {topTransactions.length > 0 && (
            <Animated.View entering={enter(section++)}>
              <SectionLabel title="Top transactions" />
              {topTransactions.map((tx) => (
                <ListRow
                  key={tx.id}
                  padded={false}
                  leading={
                    <GlyphPlate
                      name={categoryObject.icon_name}
                      type={categoryObject.icon_type}
                      color={headerColor}
                      size={36}
                      radius={10}
                    />
                  }
                  title={tx.description || categoryName}
                  subtitle={accountsById[tx.account_id]?.name || undefined}
                  trailing={<Amount cents={Math.round(tx.amount * 100)} decimals="never" />}
                />
              ))}
            </Animated.View>
          )}

          <Animated.View entering={enter(section++)}>
            <RowGroup style={styles.links}>
              <ListRow
                title="All transactions"
                value={String(txnCount)}
                chevron
                onPress={goToAllTransactions}
              />
            </RowGroup>
          </Animated.View>
        </>
      )}
    </Page>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabular: { fontVariant: ["tabular-nums"] },
  donut: { alignItems: "center", paddingTop: SPACE.sm, paddingBottom: SPACE.xl },
  donutCenter: { alignItems: "center", justifyContent: "center" },
  catRow: { paddingVertical: SPACE.md },
  catTop: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  barTrack: { marginTop: SPACE.sm },
  links: { marginTop: SPACE.xl },
});

export default SubcategoryStatScreen;

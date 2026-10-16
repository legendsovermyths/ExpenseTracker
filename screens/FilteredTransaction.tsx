import React, { useEffect, useMemo, type FC } from "react";
import { StyleSheet, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import { useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SPACE } from "../constants";
import TransactionsList from "../components/TransactionList";
import { useExpensifyStore } from "../store/store";
import { Transaction } from "../types/entity/Transaction";
import { TransactionFilter } from "../types/filters/transactionFilter";
import { applyTransactionFilter, computeTotals } from "../services/Utils";
import { ensureTransactionsLoadedFrom } from "../services/TransactionWindow";
import { useTheme } from "../contexts/ThemeContext";
import { Amount, EmptyState, LargeTitle, PageBar, Stat, StatStrip, Text } from "../components/ui";
import { BAR_HEIGHT } from "../components/ui/PageBar";

type Props = {
  filter: TransactionFilter;
};

/**
 * List page. TransactionList owns its FlashList (with sticky day headers),
 * so the title and summary are fixed above it and the bar only carries back.
 */
const FilteredTransaction: FC<Props> = () => {
  const { COLORS } = useTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const scrollY = useSharedValue(0);
  const { filter }: any = route.params;
  const transactionsById = useExpensifyStore((s) => s.transactions);

  const transactions = Object.values(transactionsById) as Transaction[];

  // The filter's date range can reach further back than the 6-month hot
  // window (e.g. drilled in from an older Statistics period) — pull in
  // older batches if needed.
  useEffect(() => {
    if (filter.startDate) ensureTransactionsLoadedFrom(new Date(filter.startDate));
  }, [filter.startDate]);

  const filtered = useMemo(
    () => applyTransactionFilter(transactions, filter),
    [transactions, filter],
  );

  const { totalIncome, totalExpenditure } = useMemo(
    () => computeTotals(filtered),
    [filtered],
  );

  const sortedFiltered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.date_time).getTime();
      const dateB = new Date(b.date_time).getTime();
      return dateB - dateA;
    });
  }, [filtered]);

  const txCount = filtered.length;

  return (
    <View style={[styles.container, { backgroundColor: COLORS.paper, paddingTop: insets.top + BAR_HEIGHT }]}>
      <LargeTitle title={filter.label} topInset={false} />

      <View style={styles.gutter}>
        <StatStrip>
          <Stat
            value={<Amount cents={Math.round(totalExpenditure * 100)} decimals="never" variant="title" />}
            label="spent"
          />
          <Stat value={<Text variant="title">{txCount}</Text>} label={txCount === 1 ? "transaction" : "transactions"} />
          {totalIncome > 0 && (
            <Stat
              value={
                <Amount
                  cents={Math.round(totalIncome * 100)}
                  decimals="never"
                  sign="always"
                  variant="title"
                  tone="down"
                />
              }
              label="income"
            />
          )}
        </StatStrip>
      </View>

      {txCount === 0 ? (
        <EmptyState icon="receipt-text-outline" title="Nothing matches" message="No transactions fit this filter." />
      ) : (
        <TransactionsList currentMonthTransactions={sortedFiltered} bottomInset={insets.bottom + SPACE.xxl} />
      )}

      <PageBar title={filter.label} scrollY={scrollY} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  gutter: { paddingHorizontal: SPACE.gutter },
});

export default FilteredTransaction;

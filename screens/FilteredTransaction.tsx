import React, { useMemo, type FC } from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { FONTS, SIZES } from "../constants";
import TransactionsList from "../components/TransactionList";
import { formatAmountWithCommas } from "../services/Utils";
import { useExpensifyStore } from "../store/store";
import { Transaction } from "../types/entity/Transaction";
import { TransactionFilter } from "../types/filters/transactionFilter";
import { applyTransactionFilter, computeTotals } from "../services/Utils";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTheme } from "../contexts/ThemeContext";
import { Icon } from "react-native-elements";

type Props = {
  filter: TransactionFilter;
};

const FilteredTransaction: FC<Props> = () => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const route = useRoute();
  const navigation = useNavigation();
  const { filter }: any = route.params;
  const transactionsById = useExpensifyStore((s) => s.transactions);

  const transactions = Object.values(transactionsById) as Transaction[];

  const filtered = useMemo(
    () => applyTransactionFilter(transactions, filter),
    [transactions, filter],
  );

  const { totalIncome, totalExpenditure } = useMemo(
    () => computeTotals(filtered),
    [filtered],
  );

  filtered.sort((a, b) => {
    const dateA: any = new Date(a.date_time);
    const dateB: any = new Date(b.date_time);
    return dateB - dateA;
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" type="material-community" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{filter.label}</Text>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.cardLabel}>Spent</Text>
          <Text style={[styles.cardAmount, { color: COLORS.red2 }]}>
            ₹{formatAmountWithCommas(totalExpenditure, false)}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.cardLabel}>Income</Text>
          <Text style={[styles.cardAmount, { color: COLORS.darkgreen }]}>
            ₹{formatAmountWithCommas(totalIncome, false)}
          </Text>
        </View>
      </View>

      {/* Transaction Count */}
      <Text style={styles.countText}>{filtered.length} transactions</Text>

      {/* Transaction List */}
      <TransactionsList currentMonthTransactions={filtered} />
    </View>
  );
};

const createStyles = (COLORS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding * 2.5,
    paddingBottom: SIZES.base,
  },
  backButton: {
    marginRight: SIZES.base,
  },
  headerTitle: {
    ...FONTS.h2,
    color: COLORS.primary,
    flex: 1,
  },
  summaryRow: {
    flexDirection: "row",
    paddingHorizontal: SIZES.padding,
    gap: SIZES.base,
    marginBottom: SIZES.base,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
    borderRadius: 10,
    padding: SIZES.padding,
  },
  cardLabel: {
    ...FONTS.body5,
    color: COLORS.darkgray,
    marginBottom: 2,
  },
  cardAmount: {
    ...FONTS.h3,
    fontWeight: "600",
  },
  countText: {
    ...FONTS.body5,
    color: COLORS.darkgray,
    paddingHorizontal: SIZES.padding,
    marginBottom: SIZES.base,
  },
});

export default FilteredTransaction;

import React, { useMemo, type FC } from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Icon } from "react-native-elements";

import { FONTS, SIZES } from "../constants";
import TransactionsList from "../components/TransactionList";
import { formatAmountWithCommas } from "../services/Utils";
import { useExpensifyStore } from "../store/store";
import { Transaction } from "../types/entity/Transaction";
import { TransactionFilter } from "../types/filters/transactionFilter";
import { applyTransactionFilter, computeTotals } from "../services/Utils";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";

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

  const sortedFiltered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.date_time).getTime();
      const dateB = new Date(b.date_time).getTime();
      return dateB - dateA;
    });
  }, [filtered]);

  const txCount = filtered.length;

  return (
    <View style={styles.container}>
      {/* Header row — back button */}
      <View style={styles.topRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.backButton}
        >
          <Icon name="arrow-left" type="material-community" size={24} color={COLORS.ink} />
        </TouchableOpacity>
      </View>

      {/* Identity */}
      <View style={styles.identityWrap}>
        <Text style={styles.identityName} numberOfLines={1}>{filter.label}</Text>
        <Text style={styles.identitySub}>FILTERED VIEW</Text>
      </View>

      {/* Compact headline */}
      <View style={styles.headlineWrap}>
        <Text style={styles.headlineAmount}>
          ₹{formatAmountWithCommas(totalExpenditure, false)}
        </Text>
        <View style={styles.headlineCaption}>
          <Text style={styles.captionPeriod}>
            {txCount} {txCount === 1 ? "transaction" : "transactions"}
          </Text>
          {totalIncome > 0 && (
            <>
              <Text style={styles.captionDot}> · </Text>
              <Text style={[styles.captionDelta, { color: COLORS.deltaDown }]}>
                +₹{formatAmountWithCommas(totalIncome, false)}
              </Text>
              <Text style={styles.captionSuffix}> income</Text>
            </>
          )}
        </View>
      </View>

      {txCount === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="receipt" type="material-community" size={44} color={COLORS.inkSubtle} />
          <Text style={styles.emptyText}>No transactions match this filter</Text>
        </View>
      ) : (
        <TransactionsList currentMonthTransactions={sortedFiltered} />
      )}
    </View>
  );
};

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.paper,
      paddingTop: SIZES.padding * 2,
    },
    topRow: {
      paddingHorizontal: SIZES.padding,
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
    identityWrap: {
      paddingHorizontal: SIZES.padding,
      marginBottom: SIZES.padding * 0.75,
    },
    identityName: {
      ...FONTS.screenTitle,
      color: COLORS.ink,
    },
    identitySub: {
      ...FONTS.caption,
      color: COLORS.inkMuted,
      letterSpacing: 1.4,
      marginTop: 4,
      textTransform: "uppercase",
    },

    // Compact headline
    headlineWrap: {
      paddingHorizontal: SIZES.padding,
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

    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: SIZES.base,
      paddingTop: SIZES.padding * 2,
    },
    emptyText: {
      ...FONTS.bodyM,
      color: COLORS.inkMuted,
    },
  });

export default FilteredTransaction;

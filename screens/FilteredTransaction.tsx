import React, { useMemo, type FC } from "react";
import { StyleSheet, View, Text } from "react-native";
import { COLORS, FONTS, SIZES } from "../constants";
import TransactionsList from "../components/TransactionList";
import { formatAmountWithCommas } from "../services/Utils";
import { useExpensifyStore } from "../store/store";
import { Transaction } from "../types/entity/Transaction";
import { TransactionFilter } from "../types/filters/transactionFilter";
import { applyTransactionFilter, computeTotals } from "../services/_Utils";
import { useRoute } from "@react-navigation/native";

const CARD_WIDTH = 345;

type Props = {
  filter: TransactionFilter;
};

const FilteredTransaction: FC<Props> = () => {
  const route = useRoute();
  const { filter }: any = route.params;
  console.log(filter);
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

  const renderTransactionHeader = (): JSX.Element => (
    <View
      style={{
        paddingHorizontal: SIZES.padding,
        paddingTop: (5 * SIZES.padding) / 2,
        backgroundColor: COLORS.white,
      }}
    >
      {/* Heading ----------------------------------------------------------- */}
      <View style={{ width: CARD_WIDTH }}>
        <Text
          style={{
            marginLeft: SIZES.padding / 6,
            color: COLORS.primary,
            ...FONTS.h1,
          }}
        >
          DEMO
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: (3 * SIZES.padding) / 4,
        }}
      >
        <View
          style={{ flex: 1, marginRight: SIZES.padding / 5, marginBottom: 5 }}
        >
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Expenditures</Text>
            <Text style={{ ...FONTS.h2, color: COLORS.red2 }}>
              ₹{formatAmountWithCommas(totalExpenditure, false)}
            </Text>
          </View>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Income</Text>
          <Text style={{ ...FONTS.h2, color: COLORS.darkgreen }}>
            ₹{formatAmountWithCommas(totalIncome, false)}
          </Text>
        </View>
      </View>

      <View style={styles.container}>
        <Text style={styles.text}>Activity</Text>
        <View style={styles.iconsContainer} />
      </View>

      <TransactionsList currentMonthTransactions={filtered} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.lightGray2 }}>
      {renderTransactionHeader()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  text: { ...FONTS.h2, color: COLORS.darkgray },
  iconsContainer: { flexDirection: "row" },
  metricCard: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 10,
    padding: SIZES.padding,
    elevation: 3,
  },
  metricLabel: { ...FONTS.h3, color: COLORS.darkgray },
});

export default FilteredTransaction;

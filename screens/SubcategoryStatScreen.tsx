import React, { useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { FONTS, SIZES } from "../constants";
import PieChartWithLegend from "../components/PieChartWithLegend";
import {
  getTransactionsGroupedBySubategories,
  getNumberOfSubcategoryTransactionsBetweenDates,
  formatAmountWithCommas,
  getMonthlyTrendForCategory,
} from "../services/Utils";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useExpensifyStore } from "../store/store";
import { Icon } from "react-native-elements";
import MonthlyTrendChart from "../components/MonthlyTrendChart";
import { useTheme } from "../contexts/ThemeContext";

const SubcategoryStatScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const categoryObject = route.params.category;
  const categoryId = categoryObject.id;
  const category = categoryObject.name;
  const percentage = route.params.percentage;
  const startDate = new Date(route.params.startDate);
  const endDate = new Date(route.params.endDate);
  const edDate = new Date(endDate);
  edDate.setDate(endDate.getDate() + 1);

  const transactionsById = useExpensifyStore((state) => state.transactions);
  const categoriesById = useExpensifyStore((state) => state.categories);
  const transactions = Object.values(transactionsById);

  const TransactionsGroupedBySubcategories = getTransactionsGroupedBySubategories(
    transactions, categoriesById, startDate, endDate, categoryObject,
  );
  const NumberOfSubcategoryTransactionsBetweenDates = getNumberOfSubcategoryTransactionsBetweenDates(
    transactions, startDate, endDate, categoryObject,
  );
  const cumulativeExpenditure = TransactionsGroupedBySubcategories.reduce(
    (acc, item) => acc + item.sum, 0,
  );
  const monthlyTrendData = getMonthlyTrendForCategory(transactions, categoryObject, 12);

  const formatDateShort = (date: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.pop()} style={styles.backButton}>
          <Icon name="arrow-left" type="material-community" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{category}</Text>
          <Text style={styles.headerSubtitle}>{formatDateShort(startDate)} - {formatDateShort(endDate)}</Text>
        </View>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Spent</Text>
          <Text style={[styles.summaryAmount, { color: COLORS.red2 }]}>
            ₹{formatAmountWithCommas(cumulativeExpenditure)}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Share</Text>
          <Text style={styles.summaryAmount}>{percentage}%</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Pie Chart */}
        <View style={styles.chartCard}>
          <PieChartWithLegend
            data={TransactionsGroupedBySubcategories}
            transactionLength={NumberOfSubcategoryTransactionsBetweenDates}
          />
        </View>

        {/* Breakdown List */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Breakdown</Text>
          {TransactionsGroupedBySubcategories.map((item, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => {
                navigation.navigate("FilteredTransaction", {
                  filter: {
                    label: item.label,
                    startDate: startDate.toISOString(),
                    endDate: edDate.toISOString(),
                    categoryIds: item.category_id ? [item.category_id] : null,
                    subcategoryIds: item.subcategory_id ? [item.subcategory_id] : null,
                  },
                });
              }}
              style={styles.itemRow}
            >
              <View style={styles.itemIcon}>
                <Icon name={item.icon_name} type={item.icon_type} size={18} color={COLORS.lightBlue} />
              </View>
              <Text style={styles.itemLabel} numberOfLines={1}>{item.label}</Text>
              <Text style={styles.itemAmount}>₹{formatAmountWithCommas(Math.abs(item.sum))}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.viewAllRow}
            onPress={() => {
              navigation.navigate("FilteredTransaction", {
                filter: {
                  label: category,
                  startDate: startDate.toISOString(),
                  endDate: edDate.toISOString(),
                  categoryIds: [categoryId],
                },
              });
            }}
          >
            <Text style={styles.viewAllText}>View all transactions</Text>
            <Icon name="chevron-right" type="material-community" size={16} color={COLORS.darkgray} />
          </TouchableOpacity>
        </View>

        {/* Monthly Trend */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Monthly Trend</Text>
          <MonthlyTrendChart data={monthlyTrendData} height={180} />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
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
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    ...FONTS.h2,
    color: COLORS.primary,
  },
  headerSubtitle: {
    ...FONTS.body5,
    color: COLORS.darkgray,
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
  summaryLabel: {
    ...FONTS.body5,
    color: COLORS.darkgray,
  },
  summaryAmount: {
    ...FONTS.h3,
    color: COLORS.primary,
  },
  scrollContent: {
    paddingHorizontal: SIZES.padding,
  },
  chartCard: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
    padding: SIZES.padding,
    marginBottom: SIZES.base,
    alignItems: "center",
  },
  card: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
    padding: SIZES.padding,
    marginBottom: SIZES.base,
  },
  cardTitle: {
    ...FONTS.body3,
    fontWeight: "600",
    color: COLORS.primary,
    marginBottom: SIZES.base,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  itemIcon: {
    backgroundColor: COLORS.white,
    height: 32,
    width: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  itemLabel: {
    flex: 1,
    ...FONTS.body4,
    color: COLORS.primary,
    marginLeft: SIZES.base,
  },
  itemAmount: {
    ...FONTS.body4,
    color: COLORS.red2,
  },
  viewAllRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: SIZES.base,
    marginTop: SIZES.base,
    borderTopWidth: 1,
    borderTopColor: COLORS.white,
  },
  viewAllText: {
    ...FONTS.body4,
    color: COLORS.darkgray,
  },
});

export default SubcategoryStatScreen;

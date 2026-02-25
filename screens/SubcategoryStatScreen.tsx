import React, { useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { FONTS, SIZES } from "../constants";
import PieChartWithLegend from "../components/PieChartWithLegend";
import {
  getTransactionsGroupedBySubategories,
  getNumberOfSubcategoryTransactionsBetweenDates,
  getNumberOfDays,
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
  const numberOfDays = getNumberOfDays(startDate, endDate);
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
          <View style={styles.headerMeta}>
            <Text style={styles.dateRange}>{formatDateShort(startDate)} - {formatDateShort(endDate)}</Text>
            <Text style={styles.percentBadge}>{percentage}%</Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Subcategories Pie Chart */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Subcategories</Text>
          <PieChartWithLegend
            data={TransactionsGroupedBySubcategories}
            transactionLength={NumberOfSubcategoryTransactionsBetweenDates}
          />
        </View>

        {/* Expenditures List */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Breakdown</Text>
            <Text style={styles.cardSubtitle}>
              ₹{formatAmountWithCommas(cumulativeExpenditure)} total
            </Text>
          </View>
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
              style={styles.expenseRow}
            >
              <View style={styles.expenseIcon}>
                <Icon
                  name={item.icon_name}
                  type={item.icon_type}
                  size={20}
                  color={COLORS.lightBlue}
                />
              </View>
              <Text style={styles.expenseLabel} numberOfLines={1}>{item.label}</Text>
              <Text style={styles.expenseAmount}>₹{formatAmountWithCommas(Math.abs(item.sum))}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.viewAllButton}
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
            <Icon name="chevron-right" type="material-community" size={18} color={COLORS.darkgray} />
          </TouchableOpacity>
        </View>

        {/* Monthly Trend */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Monthly Trend</Text>
            <Text style={styles.cardSubtitle}>Last 12 months</Text>
          </View>
          <MonthlyTrendChart data={monthlyTrendData} height={200} />
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
    paddingBottom: SIZES.padding,
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
  headerMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  dateRange: {
    ...FONTS.body5,
    color: COLORS.darkgray,
  },
  percentBadge: {
    ...FONTS.body5,
    color: COLORS.red2,
    marginLeft: SIZES.base,
    fontWeight: "600",
  },
  scrollContent: {
    paddingTop: SIZES.base,
  },
  card: {
    backgroundColor: COLORS.lightGray,
    padding: SIZES.padding,
    borderRadius: 12,
    marginHorizontal: SIZES.padding,
    marginBottom: SIZES.padding,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SIZES.base,
  },
  cardTitle: {
    ...FONTS.body3,
    fontWeight: "600",
    color: COLORS.primary,
  },
  cardSubtitle: {
    ...FONTS.body5,
    color: COLORS.darkgray,
  },
  expenseRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SIZES.base,
  },
  expenseIcon: {
    backgroundColor: COLORS.white,
    height: 36,
    width: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  expenseLabel: {
    flex: 1,
    ...FONTS.body4,
    color: COLORS.primary,
    marginLeft: SIZES.base,
  },
  expenseAmount: {
    ...FONTS.body4,
    fontWeight: "600",
    color: COLORS.red2,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: SIZES.base,
    marginTop: SIZES.base,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray,
  },
  viewAllText: {
    ...FONTS.body4,
    color: COLORS.darkgray,
  },
});

export default SubcategoryStatScreen;

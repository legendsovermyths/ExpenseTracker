import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { FONTS, SIZES } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import PieChartWithLegend from "../components/PieChartWithLegend";
import DateTimePicker from "@react-native-community/datetimepicker";
import CustomLineChart from "../components/CustomLineChart";
import { Icon } from "react-native-elements";
import { useExpensifyStore } from "../store/store";
import {
  getTransactionsGroupedByCategories,
  getTransactionsGroupedByAccount,
  getNumberOfTransactionsBetweenDates,
  getCumulativeExpenditures,
  getNumberOfDays,
  getTopTransaction,
  formatAmountWithCommas,
  getCumulativeLimit,
} from "../services/Utils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const StatsScreen: React.FC = () => {
  const { COLORS, isDark } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const transactionsById = useExpensifyStore((state) => state.transactions);
  const accountsById = useExpensifyStore((state) => state.accounts);
  const categoriesById = useExpensifyStore((state) => state.categories);
  const transactions = Object.values(transactionsById);

  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1, 0, 0, 0, 0),
  );
  const [endDate, setEndDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 0, 0, 0, 0),
  );
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [activeChart, setActiveChart] = useState<'categories' | 'accounts'>('categories');

  const monthlyBalance = parseInt(
    useExpensifyStore((state) => state.getAppconstantByKey("balance")).value,
  );
  const currentDate = new Date();

  const TransactionsGroupedByCategories = getTransactionsGroupedByCategories(
    transactions, categoriesById, startDate, endDate,
  );
  const TransactionsGroupedByBanks = getTransactionsGroupedByAccount(
    transactions, accountsById, startDate, endDate,
  );
  const NumberOfTransactionsBetweenDates = getNumberOfTransactionsBetweenDates(
    transactions, startDate, endDate,
  );
  const cumulativeExpenditure = getCumulativeExpenditures(transactions, startDate, endDate);
  const cumulativeBalance = getCumulativeLimit(monthlyBalance, startDate, endDate);
  const topTransaction = getTopTransaction(transactions, startDate, endDate);
  const numberOfDays = getNumberOfDays(startDate, endDate);

  const totalSpent = cumulativeExpenditure[cumulativeExpenditure.length - 1].value;
  const budgetLimit = cumulativeBalance[cumulativeBalance.length - 1].value;
  const percentageExpenditure = Number(
    (((totalSpent - budgetLimit) / budgetLimit) * 100).toFixed(1),
  );

  const handleStartDateChange = (event: any, selectedDate: any) => {
    if (!selectedDate) {
      setShowStartDatePicker(false);
      return;
    }
    setStartDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0, 0));
    setShowStartDatePicker(false);
  };

  const handleEndDateChange = (event: any, selectedDate: any) => {
    if (!selectedDate) {
      setShowEndDatePicker(false);
      return;
    }
    const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0, 0);
    setEndDate(end);
    if (selectedDate < startDate) setStartDate(end);
    setShowEndDatePicker(false);
  };

  const formatDateShort = (date: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  };

  const chartData = activeChart === 'categories' ? TransactionsGroupedByCategories : TransactionsGroupedByBanks;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analysis</Text>
        <Text style={styles.headerSubtitle}>{numberOfDays} days</Text>
      </View>

      {/* Date Range Selector */}
      <View style={styles.dateRow}>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => { setShowStartDatePicker(!showStartDatePicker); setShowEndDatePicker(false); }}
        >
          <Text style={styles.dateText}>{formatDateShort(startDate)}</Text>
        </TouchableOpacity>
        <Text style={styles.dateSeparator}>to</Text>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => { setShowEndDatePicker(!showEndDatePicker); setShowStartDatePicker(false); }}
        >
          <Text style={styles.dateText}>{formatDateShort(endDate)}</Text>
        </TouchableOpacity>
      </View>

      {/* Date Pickers */}
      {showStartDatePicker && (
        <DateTimePicker
          value={endDate < startDate ? endDate : startDate}
          mode="date"
          display="inline"
          onChange={handleStartDateChange}
          themeVariant={isDark ? 'dark' : 'light'}
          style={styles.datePicker}
          maximumDate={endDate}
        />
      )}
      {showEndDatePicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display="inline"
          onChange={handleEndDateChange}
          themeVariant={isDark ? 'dark' : 'light'}
          style={styles.datePicker}
          maximumDate={currentDate}
        />
      )}

      {NumberOfTransactionsBetweenDates === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="chart-pie" type="material-community" size={48} color={COLORS.gray} />
          <Text style={styles.emptyText}>No transactions</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Summary Stats */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Spent</Text>
              <Text style={[styles.summaryAmount, { color: COLORS.red2 }]}>
                ₹{formatAmountWithCommas(totalSpent)}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>vs Budget</Text>
              <Text style={[styles.summaryAmount, { color: percentageExpenditure <= 0 ? COLORS.darkgreen : COLORS.red2 }]}>
                {percentageExpenditure >= 0 ? "+" : ""}{percentageExpenditure}%
              </Text>
            </View>
          </View>

          {/* Chart Toggle */}
          <View style={styles.chartToggle}>
            <TouchableOpacity
              style={[styles.toggleButton, activeChart === 'categories' && styles.toggleButtonActive]}
              onPress={() => setActiveChart('categories')}
            >
              <Text style={[styles.toggleText, activeChart === 'categories' && styles.toggleTextActive]}>Categories</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, activeChart === 'accounts' && styles.toggleButtonActive]}
              onPress={() => setActiveChart('accounts')}
            >
              <Text style={[styles.toggleText, activeChart === 'accounts' && styles.toggleTextActive]}>Accounts</Text>
            </TouchableOpacity>
          </View>

          {/* Pie Chart */}
          <View style={styles.chartCard}>
            <PieChartWithLegend
              data={chartData}
              transactionLength={NumberOfTransactionsBetweenDates}
              isCategory={activeChart === 'categories' ? 1 : 0}
            />
          </View>

          {/* Trend */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Spending Trend</Text>
            <CustomLineChart
              cumulativeBalance={cumulativeBalance}
              cumulativeExpenditure={cumulativeExpenditure}
            />
          </View>

          {/* Top Transactions */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Top Transactions</Text>
            {topTransaction.map((item) => (
              <View key={item.id} style={styles.txRow}>
                <View style={styles.txIcon}>
                  <Icon
                    name={categoriesById[item.category_id].icon_name}
                    type={categoriesById[item.category_id].icon_type}
                    size={20}
                    color={COLORS.lightBlue}
                  />
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txDesc} numberOfLines={1}>{item.description}</Text>
                  <Text style={styles.txAccount}>{accountsById[item.account_id].name}</Text>
                </View>
                <Text style={[styles.txAmount, { color: !item.is_credit ? COLORS.red2 : COLORS.darkgreen }]}>
                  ₹{formatAmountWithCommas(Math.abs(item.amount))}
                </Text>
              </View>
            ))}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      )}
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
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding * 2.5,
    paddingBottom: SIZES.base / 2,
  },
  headerTitle: {
    ...FONTS.h1,
    color: COLORS.primary,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    ...FONTS.body3,
    color: COLORS.darkgray,
    fontWeight: "500",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SIZES.padding,
    marginTop: SIZES.base / 2,
    marginBottom: SIZES.padding / 2,
  },
  dateButton: {
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base + 2,
    borderRadius: 10,
  },
  dateText: {
    ...FONTS.body4,
    color: COLORS.primary,
    fontWeight: "600",
  },
  dateSeparator: {
    ...FONTS.body4,
    color: COLORS.darkgray,
    marginHorizontal: SIZES.base + 2,
  },
  datePicker: {
    position: "absolute",
    backgroundColor: COLORS.lightGray,
    top: 130,
    left: SIZES.padding,
    zIndex: 100,
    borderRadius: 20,
  },
  scrollContent: {
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.base / 2,
  },
  summaryRow: {
    flexDirection: "row",
    gap: SIZES.base + 4,
    marginBottom: SIZES.padding / 2,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
    borderRadius: 14,
    paddingVertical: SIZES.padding * 0.7,
    paddingHorizontal: SIZES.padding * 0.8,
  },
  summaryLabel: {
    ...FONTS.body4,
    color: COLORS.darkgray,
    fontWeight: "500",
    marginBottom: 4,
  },
  summaryAmount: {
    ...FONTS.h2,
    fontWeight: "700",
  },
  chartToggle: {
    flexDirection: "row",
    backgroundColor: COLORS.lightGray,
    borderRadius: 10,
    padding: 3,
    marginBottom: SIZES.padding / 2,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: SIZES.base,
    alignItems: "center",
    borderRadius: 8,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.white,
  },
  toggleText: {
    ...FONTS.body4,
    color: COLORS.darkgray,
  },
  toggleTextActive: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  chartCard: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 16,
    padding: SIZES.padding,
    marginBottom: SIZES.padding / 2,
    alignItems: "center",
  },
  card: {
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: SIZES.padding * 0.7,
    paddingBottom: SIZES.padding * 0.6,
    borderRadius: 16,
    marginBottom: SIZES.padding / 2,
    overflow: "hidden",
  },
  cardTitle: {
    ...FONTS.h3,
    fontWeight: "700",
    color: COLORS.primary,
    marginTop: SIZES.padding * 0.7,
    marginBottom: SIZES.base / 2,
    letterSpacing: -0.2,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SIZES.base + 2,
  },
  txIcon: {
    backgroundColor: COLORS.white,
    height: 38,
    width: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  txInfo: {
    flex: 1,
    marginLeft: SIZES.base + 4,
  },
  txDesc: {
    ...FONTS.body3,
    color: COLORS.primary,
    fontWeight: "500",
  },
  txAccount: {
    ...FONTS.body4,
    fontSize: 12,
    color: COLORS.darkgray,
    marginTop: 1,
  },
  txAmount: {
    ...FONTS.body3,
    fontWeight: "600",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: SIZES.padding,
  },
  emptyText: {
    ...FONTS.body3,
    color: COLORS.darkgray,
  },
});

export default StatsScreen;

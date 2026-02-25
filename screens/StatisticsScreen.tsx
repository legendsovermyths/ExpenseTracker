import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import Carousel from "react-native-snap-carousel";
import { FONTS, SIZES, icons } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import PieChartWithLegend from "../components/PieChartWithLegend";
import { getFormattedDateWithYear } from "../services/Utils";
import DateTimePicker from "@react-native-community/datetimepicker";
import CustomLineChart from "../components/CustomLineChart";
import { useNavigation } from "@react-navigation/native";
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

const StatsScreen: React.FC = () => {
  const { COLORS, isDark } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const navigation = useNavigation();
  const transactionsById = useExpensifyStore((state) => state.transactions);
  const accountsById = useExpensifyStore((state) => state.accounts);
  const categoriesById = useExpensifyStore((state) => state.categories);
  const transactions = Object.values(transactionsById);
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1, 0, 0, 0, 0),
  );
  const [endDate, setEndDate] = useState(
    new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate(),
      0, 0, 0, 0,
    ),
  );
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const monthlyBalance = parseInt(
    useExpensifyStore((state) => state.getAppconstantByKey("balance")).value,
  );
  const currentDate = new Date();

  const TransactionsGroupedByCategories = getTransactionsGroupedByCategories(
    transactions,
    categoriesById,
    startDate,
    endDate,
  );
  const TransactionsGroupedByBanks = getTransactionsGroupedByAccount(
    transactions,
    accountsById,
    startDate,
    endDate,
  );
  const NumberOfTransactionsBetweenDates = getNumberOfTransactionsBetweenDates(
    transactions,
    startDate,
    endDate,
  );
  const cumulativeExpenditure = getCumulativeExpenditures(
    transactions,
    startDate,
    endDate,
  );
  const cumulativeBalance = getCumulativeLimit(
    monthlyBalance,
    startDate,
    endDate,
  );
  const topTransaction = getTopTransaction(transactions, startDate, endDate);
  const numberOfDays = getNumberOfDays(startDate, endDate);
  const percentageExpenditure = Number(
    (
      ((cumulativeExpenditure[cumulativeExpenditure.length - 1].value -
        cumulativeBalance[cumulativeBalance.length - 1].value) /
        cumulativeBalance[cumulativeBalance.length - 1].value) *
      100
    ).toFixed(1),
  );

  const handleStartDateChange = (event: any, selectedDate: any) => {
    const start = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      0, 0, 0, 0,
    );
    setStartDate(start);
    setShowStartDatePicker(false);
  };

  const handleEndDateChange = (event: any, selectedDate: any) => {
    const end = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      0, 0, 0, 0,
    );
    setEndDate(end);
    if (selectedDate < startDate) {
      setStartDate(end);
    }
    setShowEndDatePicker(false);
  };

  const renderItem = ({ item }: { item: number }) => {
    const isCategories = item === 0;
    const data = isCategories ? TransactionsGroupedByCategories : TransactionsGroupedByBanks;
    const title = isCategories ? "Categories" : "Accounts";

    return (
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>{title}</Text>
          <Text style={styles.chartCount}>{data.length} total</Text>
        </View>
        <PieChartWithLegend
          data={data}
          transactionLength={NumberOfTransactionsBetweenDates}
          isCategory={isCategories ? 1 : 0}
        />
      </View>
    );
  };

  // Format date range for header
  const formatDateShort = (date: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analysis</Text>

        {/* Date Range Selector */}
        <View style={styles.dateRangeRow}>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => {
              setShowStartDatePicker(!showStartDatePicker);
              setShowEndDatePicker(false);
            }}
          >
            <Text style={styles.dateText}>{formatDateShort(startDate)}</Text>
          </TouchableOpacity>
          <Text style={styles.dateSeparator}>—</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => {
              setShowEndDatePicker(!showEndDatePicker);
              setShowStartDatePicker(false);
            }}
          >
            <Text style={styles.dateText}>{formatDateShort(endDate)}</Text>
          </TouchableOpacity>
          <View style={styles.percentageBadge}>
            <Text style={[
              styles.percentageText,
              { color: percentageExpenditure <= 0 ? COLORS.darkgreen : COLORS.red2 }
            ]}>
              {percentageExpenditure >= 0 ? "+" : ""}{percentageExpenditure}%
            </Text>
          </View>
        </View>

        {/* Date Pickers */}
        {showStartDatePicker && (
          <DateTimePicker
            testID="dateTimePicker"
            value={endDate < startDate ? endDate : startDate}
            mode="date"
            is24Hour={true}
            display="inline"
            onChange={handleStartDateChange}
            themeVariant={isDark ? 'dark' : 'light'}
            style={styles.datePicker}
            maximumDate={endDate}
          />
        )}
        {showEndDatePicker && (
          <DateTimePicker
            testID="dateTimePicker"
            value={endDate}
            mode="date"
            is24Hour={true}
            display="inline"
            onChange={handleEndDateChange}
            themeVariant={isDark ? 'dark' : 'light'}
            style={styles.datePicker}
            maximumDate={currentDate}
          />
        )}
      </View>

      {NumberOfTransactionsBetweenDates === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="chart-pie" type="material-community" size={48} color={COLORS.gray} />
          <Text style={styles.emptyText}>No transactions in this period</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
        >
          {/* Pie Charts Carousel */}
          <Carousel
            data={[0, 1]}
            renderItem={renderItem}
            sliderWidth={SIZES.width}
            itemWidth={SIZES.width - SIZES.padding}
            layout="default"
          />

          {/* Trend Chart */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Spending Trend</Text>
            <CustomLineChart
              cumulativeBalance={cumulativeBalance}
              cumulativeExpenditure={cumulativeExpenditure}
            />
            <Text style={styles.summaryText}>
              Spent <Text style={styles.amountHighlight}>
                ₹{formatAmountWithCommas(cumulativeExpenditure[cumulativeExpenditure.length - 1].value)}
              </Text> over {NumberOfTransactionsBetweenDates} transactions in {numberOfDays} days
            </Text>
          </View>

          {/* Top Transactions */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Top Transactions</Text>
            {topTransaction.map((item) => (
              <View key={item.id} style={styles.transactionRow}>
                <View style={styles.transactionIcon}>
                  <Icon
                    name={categoriesById[item.category_id].icon_name}
                    type={categoriesById[item.category_id].icon_type}
                    size={22}
                    color={COLORS.lightBlue}
                  />
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionDesc} numberOfLines={1}>
                    {item.description}
                  </Text>
                  <Text style={styles.transactionAccount}>
                    {accountsById[item.account_id].name}
                  </Text>
                </View>
                <Text style={[
                  styles.transactionAmount,
                  { color: !item.is_credit ? COLORS.red2 : COLORS.darkgreen }
                ]}>
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
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding * 2.5,
    backgroundColor: COLORS.white,
    zIndex: 100,
  },
  headerTitle: {
    ...FONTS.h1,
    color: COLORS.primary,
    marginBottom: SIZES.base,
  },
  dateRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SIZES.base,
  },
  dateButton: {
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
    borderRadius: 8,
  },
  dateText: {
    ...FONTS.body3,
    color: COLORS.primary,
  },
  dateSeparator: {
    ...FONTS.body3,
    color: COLORS.darkgray,
    marginHorizontal: SIZES.base,
  },
  percentageBadge: {
    marginLeft: "auto",
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: SIZES.base,
    paddingVertical: 4,
    borderRadius: 6,
  },
  percentageText: {
    ...FONTS.body4,
    fontSize: 12,
    fontWeight: "600",
  },
  datePicker: {
    position: "absolute",
    backgroundColor: COLORS.lightGray,
    top: 120,
    left: SIZES.padding,
    zIndex: 100,
    borderRadius: 20,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: SIZES.base,
  },
  chartCard: {
    backgroundColor: COLORS.lightGray,
    padding: SIZES.padding,
    borderRadius: 16,
    marginRight: SIZES.padding,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SIZES.base,
  },
  chartTitle: {
    ...FONTS.h3,
    color: COLORS.primary,
  },
  chartCount: {
    ...FONTS.body4,
    color: COLORS.darkgray,
  },
  card: {
    backgroundColor: COLORS.lightGray,
    padding: SIZES.padding,
    borderRadius: 16,
    marginHorizontal: SIZES.padding,
    marginTop: SIZES.padding,
  },
  cardTitle: {
    ...FONTS.h3,
    color: COLORS.primary,
    marginBottom: SIZES.base,
  },
  summaryText: {
    ...FONTS.body4,
    color: COLORS.primary,
    marginTop: SIZES.base,
  },
  amountHighlight: {
    color: COLORS.red2,
    fontWeight: "600",
  },
  transactionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SIZES.base,
  },
  transactionIcon: {
    backgroundColor: COLORS.white,
    height: 40,
    width: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  transactionInfo: {
    flex: 1,
    marginLeft: SIZES.base,
  },
  transactionDesc: {
    ...FONTS.body3,
    color: COLORS.primary,
  },
  transactionAccount: {
    ...FONTS.body5,
    color: COLORS.darkgray,
  },
  transactionAmount: {
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

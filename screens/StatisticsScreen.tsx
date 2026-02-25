import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import Carousel from "react-native-snap-carousel";
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

  const percentageExpenditure = Number(
    (((cumulativeExpenditure[cumulativeExpenditure.length - 1].value -
        cumulativeBalance[cumulativeBalance.length - 1].value) /
        cumulativeBalance[cumulativeBalance.length - 1].value) * 100
    ).toFixed(1),
  );

  const handleStartDateChange = (event: any, selectedDate: any) => {
    if (!selectedDate) {
      setShowStartDatePicker(false);
      return;
    }
    const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0, 0);
    setStartDate(start);
    setShowStartDatePicker(false);
  };

  const handleEndDateChange = (event: any, selectedDate: any) => {
    if (!selectedDate) {
      setShowEndDatePicker(false);
      return;
    }
    const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0, 0);
    setEndDate(end);
    if (selectedDate < startDate) {
      setStartDate(end);
    }
    setShowEndDatePicker(false);
  };

  const formatDateShort = (date: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  };

  const renderItem = ({ item }: { item: number }) => {
    const isCategories = item === 0;
    const data = isCategories ? TransactionsGroupedByCategories : TransactionsGroupedByBanks;
    const title = isCategories ? "Categories" : "Accounts";

    return (
      <View style={styles.chartCard}>
        <Text style={styles.cardTitle}>{title}</Text>
        <PieChartWithLegend
          data={data}
          transactionLength={NumberOfTransactionsBetweenDates}
          isCategory={isCategories ? 1 : 0}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analysis</Text>

        {/* Date Range */}
        <View style={styles.dateRow}>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => { setShowStartDatePicker(!showStartDatePicker); setShowEndDatePicker(false); }}
          >
            <Text style={styles.dateText}>{formatDateShort(startDate)}</Text>
          </TouchableOpacity>
          <Text style={styles.dateSeparator}>-</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => { setShowEndDatePicker(!showEndDatePicker); setShowStartDatePicker(false); }}
          >
            <Text style={styles.dateText}>{formatDateShort(endDate)}</Text>
          </TouchableOpacity>
          <Text style={[styles.percentText, { color: percentageExpenditure <= 0 ? COLORS.darkgreen : COLORS.red2 }]}>
            {percentageExpenditure >= 0 ? "+" : ""}{percentageExpenditure}%
          </Text>
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
      </View>

      {NumberOfTransactionsBetweenDates === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="chart-pie" type="material-community" size={48} color={COLORS.gray} />
          <Text style={styles.emptyText}>No transactions</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Pie Charts */}
          <Carousel
            data={[0, 1]}
            renderItem={renderItem}
            sliderWidth={SIZES.width}
            itemWidth={SIZES.width - SIZES.padding}
            layout="default"
          />

          {/* Trend */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Trend</Text>
            <CustomLineChart
              cumulativeBalance={cumulativeBalance}
              cumulativeExpenditure={cumulativeExpenditure}
            />
            <Text style={styles.summaryText}>
              ₹{formatAmountWithCommas(cumulativeExpenditure[cumulativeExpenditure.length - 1].value)} spent in {numberOfDays} days
            </Text>
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
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding * 2.5,
    backgroundColor: COLORS.white,
    zIndex: 100,
  },
  headerTitle: {
    ...FONTS.h1,
    color: COLORS.primary,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SIZES.base,
    marginBottom: SIZES.base,
  },
  dateButton: {
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
    borderRadius: 8,
  },
  dateText: {
    ...FONTS.body4,
    color: COLORS.primary,
  },
  dateSeparator: {
    ...FONTS.body4,
    color: COLORS.darkgray,
    marginHorizontal: SIZES.base,
  },
  percentText: {
    ...FONTS.body4,
    fontWeight: "600",
    marginLeft: "auto",
  },
  datePicker: {
    position: "absolute",
    backgroundColor: COLORS.lightGray,
    top: 100,
    left: SIZES.padding,
    zIndex: 100,
    borderRadius: 20,
  },
  scrollContent: {
    paddingTop: SIZES.base,
  },
  chartCard: {
    backgroundColor: COLORS.lightGray,
    padding: SIZES.padding,
    borderRadius: 12,
    marginRight: SIZES.padding,
  },
  card: {
    backgroundColor: COLORS.lightGray,
    padding: SIZES.padding,
    borderRadius: 12,
    marginHorizontal: SIZES.padding,
    marginTop: SIZES.padding,
  },
  cardTitle: {
    ...FONTS.body3,
    fontWeight: "600",
    color: COLORS.primary,
    marginBottom: SIZES.base,
  },
  summaryText: {
    ...FONTS.body4,
    color: COLORS.darkgray,
    marginTop: SIZES.base,
    textAlign: "center",
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SIZES.base,
  },
  txIcon: {
    backgroundColor: COLORS.white,
    height: 36,
    width: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  txInfo: {
    flex: 1,
    marginLeft: SIZES.base,
  },
  txDesc: {
    ...FONTS.body4,
    color: COLORS.primary,
  },
  txAccount: {
    ...FONTS.body5,
    fontSize: 11,
    color: COLORS.darkgray,
  },
  txAmount: {
    ...FONTS.body4,
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

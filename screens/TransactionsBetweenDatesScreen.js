import React, { useContext, useState } from "react";
import {
  View,
  Text,
  Button,
  Image,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { COLORS, FONTS, SIZES, icons, PRETTYCOLORS } from "../constants";
import { DataContext } from "../contexts/DataContext";
import {
  getFormattedDateWithYear,
  getTransactionsGroupedByCategories,
  getTransactionsGroupedByBank,
  getNumberOfTransactionsBetweenDates,
  getCumulativeExpenditures,
  getCumulativeLimit,
  formatAmountWithCommas,
  getTransactionBetweenDates,
  getNumberOfDays,
  getTopTransaction,
} from "../services/Utils";
import DateTimePicker from "@react-native-community/datetimepicker";
import CustomLineChart from "../components/CustomLineChart";
import TransactionsList from "../components/TransactionList";
import { useNavigation } from "@react-navigation/native";
const TransactionsBetweenDatesScreen = () => {
  const navigation = useNavigation();
  const { transactions, constants } = useContext(DataContext);
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [endDate, setEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const transactionBetweenDates = getTransactionBetweenDates(
    transactions,
    startDate,
    endDate,
  );
  transactionBetweenDates.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB - dateA;
  });
  const currentDate = new Date();
  const TransactionsGroupedByCategories = getTransactionsGroupedByCategories(
    transactions,
    startDate,
    endDate,
  );
  const TransactionsGroupedByBanks = getTransactionsGroupedByBank(
    transactions,
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
  const monthlyBalance = constants.find(
    (item) => item.name === "balance",
  )?.value;
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

  const handleStartDateChange = (event, selectedDate) => {
    setStartDate(selectedDate);
    setShowStartDatePicker(false);
  };
  const handleEndDateChange = (event, selectedDate) => {
    setEndDate(selectedDate);
    if (selectedDate < startDate) {
      setStartDate(selectedDate);
    }
    setShowEndDatePicker(false);
  };
  const handleGoBack = () => {
    navigation.pop();
  };
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      <View
        style={{
          paddingHorizontal: SIZES.padding,
          paddingTop: (5 * SIZES.padding) / 2,
          backgroundColor: COLORS.white,
        }}
      >
        <TouchableOpacity onPress={handleGoBack}>
          <Image
            source={icons.back_arrow}
            style={{ width: 30, height: 30, tintColor: COLORS.primary }}
          />
        </TouchableOpacity>
      </View>
      <View
        style={{
          paddingHorizontal: SIZES.padding,
          backgroundColor: COLORS.white,
          paddingTop: SIZES.padding / 2,
        }}
      >
        {showStartDatePicker && (
          <DateTimePicker
            testID="dateTimePicker"
            value={endDate < startDate ? endDate : startDate}
            mode="date"
            is24Hour={true}
            display="inline"
            onChange={handleStartDateChange}
            backgroundColor={COLORS.blue}
            style={{
              position: "absolute",
              backgroundColor: COLORS.lightGray,
              top: 180,
              left: 30,
              zIndex: 100,
              borderRadius: 50,
            }}
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
            backgroundColor={COLORS.blue}
            style={{
              position: "absolute",
              backgroundColor: COLORS.lightGray,
              top: 180,
              left: 30,
              zIndex: 100,
              borderRadius: 50,
            }}
            maximumDate={currentDate}
          />
        )}

        <Text
          style={{
            marginLeft: SIZES.padding / 6,
            color: COLORS.primary,
            ...FONTS.h1,
          }}
        >
          My Expenses
        </Text>
        <Text
          style={{
            marginLeft: SIZES.padding / 6,
            color: COLORS.darkgray,
            ...FONTS.h3,
          }}
        >
          Summary
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: SIZES.padding / 2,
            marginBottom: 10,
          }}
        >
          <View
            style={{
              backgroundColor: COLORS.lightGray,
              height: 50,
              width: 50,
              borderRadius: 25,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Image
              source={icons.calendar}
              style={{ width: 20, height: 20, tintColor: COLORS.lightBlue }}
            />
          </View>
          <View style={{ flex: 1, marginLeft: SIZES.padding / 3 }}>
            <View style={{ flexDirection: "row" }}>
              <TouchableOpacity
                onPress={() => {
                  setShowStartDatePicker(!showStartDatePicker),
                    setShowEndDatePicker(false);
                }}
              >
                <Text style={{ color: COLORS.primary, ...FONTS.h3 }}>
                  {getFormattedDateWithYear(startDate, 0)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowEndDatePicker(!showEndDatePicker),
                    setShowStartDatePicker(false);
                }}
              >
                <Text style={{ color: COLORS.primary, ...FONTS.h3 }}>
                  {" - " + getFormattedDateWithYear(endDate, 0)}
                </Text>
              </TouchableOpacity>
            </View>

            <Text
              style={{
                ...FONTS.body3,
                color:
                  percentageExpenditure <= 0 ? COLORS.darkgreen : COLORS.red2,
              }}
            >
              {(percentageExpenditure >= 0 ? "+" : "") +
                `${percentageExpenditure}% average expenditures`}
            </Text>
          </View>
        </View>
        <TransactionsList currentMonthTransactions={transactionBetweenDates} />
      </View>
    </View>
  );
};

export default TransactionsBetweenDatesScreen;

import React, { useContext, useState } from "react";
import {
  View,
  Text,
  Button,
  Image,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import Carousel from "react-native-snap-carousel";
import { COLORS, FONTS, SIZES, icons, PRETTYCOLORS } from "../constants";
import PieChartWithLegend from "../components/PieChartWithLegend";
import { DataContext } from "../contexts/DataContext";
import {
  getFormattedDateWithYear,
  getTransactionsGroupedByCategories,
  getTransactionsGroupedByBank,
  getNumberOfTransactionsBetweenDates,
  getCumulativeExpenditures,
  getCumulativeLimit,
  formatAmountWithCommas,
  getNumberOfDays,
  getTopTransaction,
} from "../services/Utils";
import DateTimePicker from "@react-native-community/datetimepicker";
import CustomLineChart from "../components/CustomLineChart";
import { useNavigation } from "@react-navigation/native";
import { Icon } from "react-native-elements";

const StatsScreen = () => {
  const navigation = useNavigation();
  const { transactions, constants } = useContext(DataContext);
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [endDate, setEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const currentDate = new Date();
  const handleViewAllTransactions=()=>{
    navigation.navigate("TransactionsBetweenDates");
  }
  const TransactionsGroupedByCategories = getTransactionsGroupedByCategories(
    transactions,
    startDate,
    endDate
  );
  const TransactionsGroupedByBanks = getTransactionsGroupedByBank(
    transactions,
    startDate,
    endDate
  );
  const NumberOfTransactionsBetweenDates = getNumberOfTransactionsBetweenDates(
    transactions,
    startDate,
    endDate
  );
  const cumulativeExpenditure = getCumulativeExpenditures(
    transactions,
    startDate,
    endDate
  );
  const monthlyBalance = constants.find(
    (item) => item.name === "balance"
  )?.value;
  const cumulativeBalance = getCumulativeLimit(
    monthlyBalance,
    startDate,
    endDate
  );
  const topTransaction=getTopTransaction(transactions,startDate,endDate);
  const numberOfDays = getNumberOfDays(startDate, endDate);
  const percentageExpenditure = Number(
    (
      ((cumulativeExpenditure[cumulativeExpenditure.length - 1].value -
        cumulativeBalance[cumulativeBalance.length - 1].value) /
      cumulativeBalance[cumulativeBalance.length - 1].value)*100
    ).toFixed(1)
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
  const renderItem = ({ item }) => {
    let chartComponent;

    switch (item) {
      case 0:
        chartComponent = (
          <View
            style={{
              backgroundColor: COLORS.lightGray,
              padding: 5,
              borderRadius: 20,
              marginRight: 48,
            }}
          >
            <Text
              style={{
                marginTop: 10,
                marginLeft: 10,
                color: COLORS.primary,
                ...FONTS.h3,
              }}
            >
              CATEGORIES
            </Text>
            <Text
              style={{
                marginBottom: 5,
                marginLeft: 10,
                color: COLORS.darkgray,
                ...FONTS.body4,
              }}
            >
              {TransactionsGroupedByCategories.length + " total"}
            </Text>
            <PieChartWithLegend
              data={TransactionsGroupedByCategories}
              transactionLength={NumberOfTransactionsBetweenDates}
            />
          </View>
        );
        break;
      case 1:
        chartComponent = (
          <View
            style={{
              backgroundColor: COLORS.lightGray,
              padding: 5,
              borderRadius: 20,
              marginRight: 48,
            }}
          >
            <Text
              style={{
                marginTop: 10,
                marginLeft: 10,
                color: COLORS.primary,
                ...FONTS.h3,
              }}
            >
              ACCOUNTS
            </Text>
            <Text
              style={{
                marginBottom: 5,
                marginLeft: 10,
                color: COLORS.darkgray,
                ...FONTS.body4,
              }}
            >
              {TransactionsGroupedByBanks.length + " total"}
            </Text>
            <PieChartWithLegend
              data={TransactionsGroupedByBanks}
              transactionLength={NumberOfTransactionsBetweenDates}
            />
          </View>
        );
        break;

      default:
        chartComponent = null;
        break;
    }

    return chartComponent;
  };
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      {/* Header section */}
      <View
        style={{
          paddingHorizontal: SIZES.padding,
          paddingTop: (5 * SIZES.padding) / 2,
          backgroundColor: COLORS.white,
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
          Analysis
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

            <Text style={{ ...FONTS.body3, color:percentageExpenditure<=0? COLORS.darkgreen:COLORS.red2 }}>
              {(percentageExpenditure >= 0 ? "+" : "") +
                `${percentageExpenditure}% average expenditures`}
            </Text>
          </View>
          <View style={{ marginLeft: SIZES.padding }}></View>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}
  showsHorizontalScrollIndicator={false} style={{marginBottom:6*SIZES.padding}}>
          <Carousel
            data={[0, 1]} // Array representing each item in the carousel
            renderItem={renderItem}
            sliderWidth={SIZES.width}
            itemWidth={SIZES.width}
            layout="default"
          />
          <View
            style={{
              backgroundColor: COLORS.lightGray,
              padding: 5,
              borderRadius: 20,
              marginTop:15
              
            }}
          >
            <Text
              style={{
                marginTop: 10,
                marginLeft: 10,
                color: COLORS.primary,
                ...FONTS.h3,
              }}
            >
              TREND
            </Text>
            <CustomLineChart
              cumulativeBalance={cumulativeBalance}
              cumulativeExpenditure={cumulativeExpenditure}
            />
            <View>
              <Text
                style={{
                  marginTop: 10,
                  marginLeft: 10,
                  marginBottom: 10,
                  color: COLORS.primary,
                  ...FONTS.body3,
                }}
              >
                You spent{" "}
                <Text style={{ color: COLORS.red2, ...FONTS.h3 }}>
                  ₹
                  {formatAmountWithCommas(
                    cumulativeExpenditure[cumulativeExpenditure.length - 1]
                      .value
                  )}
                </Text>{" "}
                over {NumberOfTransactionsBetweenDates} transactions in{" "}
                {numberOfDays} days
              </Text>
            </View>
          </View>
           <View
            style={{
              backgroundColor: COLORS.lightGray,
              padding: 5,
              borderRadius: 20,
              marginTop:10
            }}
          >
            <Text
              style={{
                marginTop: 10,
                marginLeft: 10,
                color: COLORS.primary,
                ...FONTS.h3,
              }}
            >
              Top Transactions
            </Text>
            
            {
              topTransaction.map(item => (
                <View
                  key={item.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: SIZES.padding / 2,
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
                    <Icon
                  name={item.icon_name}
                  type={item.icon_type}
                  size={27}
                  color={COLORS.lightBlue}
                />
                  </View>
                  <View style={{ flex: 1, marginLeft: SIZES.padding / 3 }}>
                    <Text style={{ color: COLORS.primary, ...FONTS.h4 }}>
                      {item.title}
                    </Text>
                    <Text style={{ ...FONTS.body4, color: COLORS.darkgray }}>
                      {item.bank_name}
                    </Text>
                  </View>
                  <View style={{ marginRight: SIZES.padding/3 }}>
                    <Text
                      style={{
                        color: item.amount < 0 ? COLORS.red2 : COLORS.darkgreen,
                        ...FONTS.h3,
                      }}
                    >
                      ₹{formatAmountWithCommas(Math.abs(item.amount))}
                    </Text>
                  </View>
                </View>
              ))
            }
             
          </View>
          <TouchableOpacity onPress={handleViewAllTransactions}>
      <Text style={ {
    color: COLORS.darkgray,
    textDecorationLine: 'underline',
    marginTop: 10,
    marginRight:10,
    alignSelf: 'flex-end',
    ...FONTS.body4
      }}>{"View All Transactions>>"}</Text>
    </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
};

export default StatsScreen;

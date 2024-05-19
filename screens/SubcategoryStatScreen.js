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
  getNumberOfSubcategoryTransactionsBetweenDates,
  getTransactionsGroupedBySubategories,
} from "../services/Utils";
import DateTimePicker from "@react-native-community/datetimepicker";
import CustomLineChart from "../components/CustomLineChart";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Icon } from "react-native-elements";

const SubcategoryStatScreen = () => {
  route = useRoute();
  const category = route.params.category;
  const percentage = route.params.percentage;
  console.log(category);
  const navigation = useNavigation();
  const { transactions, constants } = useContext(DataContext);
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [endDate, setEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const currentDate = new Date();
  const handleViewAllTransactions = () => {
    navigation.navigate("TransactionsBetweenDates");
  };
  const TransactionsGroupedBySubcategories =
    getTransactionsGroupedBySubategories(
      transactions,
      startDate,
      endDate,
      category
    );
  const NumberOfSubcategoryTransactionsBetweenDates =
    getNumberOfSubcategoryTransactionsBetweenDates(
      transactions,
      startDate,
      endDate,
      category
    );
    const cumulativeExpenditure = TransactionsGroupedBySubcategories.reduce(
      (acc, item) => acc + item.sum,
      0
    );
  const monthlyBalance = constants.find(
    (item) => item.name === "balance"
  )?.value;
  //const topCategoryTransaction=getTopCategoryTransaction(transactions,startDate,endDate,category);
  const numberOfDays = getNumberOfDays(startDate, endDate);
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
  const handleBack = () => {
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
        <TouchableOpacity onPress={handleBack}>
          <Image
            source={icons.back_arrow}
            style={{ width: 30, height: 30, tintColor: COLORS.primary }}
          />
        </TouchableOpacity>
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
            marginTop: SIZES.padding / 3,
            color: COLORS.primary,
            ...FONTS.h1,
          }}
        >
          {category}
        </Text>
        <Text
          style={{
            marginLeft: SIZES.padding / 6,
            color: COLORS.darkgray,
            ...FONTS.h3,
          }}
        >
          Analysis
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
            <Text style={{ ...FONTS.body3, color: COLORS.red2 }}>
              {`${percentage}% of total expenditures`}
            </Text>
          </View>
          <View style={{ marginLeft: SIZES.padding }}></View>
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 6 * SIZES.padding }}
        >
          <View
            style={{
              backgroundColor: COLORS.lightGray,
              padding: 5,
              borderRadius: 20,
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
              SUB-CATEGORIES
            </Text>
            <Text
              style={{
                marginBottom: 5,
                marginLeft: 10,
                color: COLORS.darkgray,
                ...FONTS.body4,
              }}
            >
              {TransactionsGroupedBySubcategories.length + " total"}
            </Text>
            <PieChartWithLegend
              data={TransactionsGroupedBySubcategories}
              transactionLength={NumberOfSubcategoryTransactionsBetweenDates}
            />
          </View>
          <View
            style={{
              backgroundColor: COLORS.lightGray,
              padding: 5,
              borderRadius: 20,
              marginTop:15,
              marginBottom:3*SIZES.padding,
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
              EXPENDITURES
            </Text>
            {TransactionsGroupedBySubcategories.map((item, index) => (
          <Text key={index}  style={{
            marginTop: 5,
            marginLeft: 10,
            color: COLORS.primary,
            ...FONTS.h3,
          }}>
            {index+1}. {item.label}{" : "}
            <Text style={{ color: COLORS.red2 }}>₹{formatAmountWithCommas(item.sum)}</Text>
          </Text>
          
        ))}
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
                    cumulativeExpenditure
                  )}
                </Text>{" "}
                over {NumberOfSubcategoryTransactionsBetweenDates} transactions in{" "}
                {numberOfDays} days
              </Text>
            
            
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

export default SubcategoryStatScreen;

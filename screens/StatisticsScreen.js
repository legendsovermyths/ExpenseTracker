import React, { useContext, useState } from "react";
import { View, Text, Button, Image, ScrollView, TouchableOpacity } from "react-native";

import { COLORS, FONTS, SIZES, icons, PRETTYCOLORS } from "../constants";
import PieChartWithLegend from "../components/PieChartWithLegend";
import { DataContext } from "../contexts/DataContext";
import { getFormattedDateWithYear } from "../services/Utils";
import DateTimePicker from "@react-native-community/datetimepicker";

const StatsScreen = () => {
  const { transactions, banks } = useContext(DataContext);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [endDate, setEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const currentDate = new Date();
  const transactionLength=transactions.length;
  console.log(endDate,transactions[1].date);
  console.log(new Date(transactions[1].date)<=endDate);
  const filteredTransactions = transactions.filter(
    (transaction) => new Date(transaction.date) >= startDate && new Date(transaction.date) <= endDate
  );
  const groupedTransactions = filteredTransactions
    .filter((transaction) => transaction.amount < 0)
    .reduce((acc, cur) => {
      if (!acc[cur.category]) {
        acc[cur.category] = {
          label: cur.category,
          sum: Math.abs(cur.amount),
          color: PRETTYCOLORS[Object.keys(acc).length % PRETTYCOLORS.length],
        };
      } else {
        acc[cur.category].sum += Math.abs(cur.amount);
      }
      return acc;
    }, {});
  console.log(filteredTransactions);
  const totalSum = filteredTransactions
    .filter((transaction) => transaction.amount < 0)
    .reduce((acc, cur) => acc + Math.abs(cur.amount), 0);
  for (let category in groupedTransactions) {
    groupedTransactions[category].value = Number(
      ((groupedTransactions[category].sum / totalSum) * 100).toFixed(1)
    );
  }
  const result = Object.values(groupedTransactions);
  console.log(result);
  const handleStartDateChange=(event,selectedDate)=>{
    setStartDate(selectedDate);
    setShowStartDatePicker(false);
  }
  const handleEndDateChange=(event,selectedDate)=>{
    setEndDate(selectedDate);
    if(endDate<startDate){
      setStartDate(selectedDate);
    }
    setShowEndDatePicker(false);
  }
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      
      {/* Header section */}
      <View
        style={{
          paddingHorizontal: SIZES.padding,
          paddingVertical: (5 * SIZES.padding) / 2,
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
              <TouchableOpacity onPress={()=>setShowStartDatePicker(!showStartDatePicker)}>
              <Text style={{ color: COLORS.primary, ...FONTS.h3 }}>
                {getFormattedDateWithYear(startDate, 0)}
              </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={()=>setShowEndDatePicker(!showEndDatePicker)}>
              <Text style={{ color: COLORS.primary, ...FONTS.h3 }}>
                {" - "+getFormattedDateWithYear(endDate, 0)}
              </Text>
              </TouchableOpacity>
            </View>
            
            <Text style={{ ...FONTS.body3, color: COLORS.darkgreen }}>
              {"+2.5% average transactions"}
            </Text>
          </View>
          <View style={{ marginLeft: SIZES.padding }}></View>
        </View>
        <ScrollView>
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
              {result.length + " total"}
            </Text>
            <PieChartWithLegend
              data={result}
              transactionLength={transactionLength}
            />
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

export default StatsScreen;

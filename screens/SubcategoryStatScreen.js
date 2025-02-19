import React from "react";
import { View, Text, Image, ScrollView, TouchableOpacity } from "react-native";
import { COLORS, FONTS, SIZES, icons, PRETTYCOLORS } from "../constants";
import PieChartWithLegend from "../components/PieChartWithLegend";
import {
  getFormattedDateWithYear,
} from "../services/Utils";
import {
  getTransactionsGroupedBySubategories,
  getNumberOfSubcategoryTransactionsBetweenDates,
  getNumberOfDays,
  formatAmountWithCommas,
} from "../services/_Utils";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useExpensifyStore } from "../store/store";

const SubcategoryStatScreen = () => {
  route = useRoute();
  const categoryObject = route.params.category;
  const category = categoryObject.name;
  const percentage = route.params.percentage;
  const startDate = new Date(route.params.startDate);
  const endDate = new Date(route.params.endDate);
  console.log(endDate);
  const navigation = useNavigation();
  const transactionsById = useExpensifyStore((state) => state.transactions);
  const categoriesById = useExpensifyStore((state) => state.categories);
  const transactions = Object.values(transactionsById);
  const TransactionsGroupedBySubcategories =
    getTransactionsGroupedBySubategories(
      transactions,
      categoriesById,
      startDate,
      endDate,
      categoryObject,
    );
  const NumberOfSubcategoryTransactionsBetweenDates =
    getNumberOfSubcategoryTransactionsBetweenDates(
      transactions,
      startDate,
      endDate,
      categoryObject,
    );
  const cumulativeExpenditure = TransactionsGroupedBySubcategories.reduce(
    (acc, item) => acc + item.sum,
    0,
  );
  const numberOfDays = getNumberOfDays(startDate, endDate);
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
              <Text style={{ color: COLORS.primary, ...FONTS.h3 }}>
                {getFormattedDateWithYear(startDate, 0)}
              </Text>

              <Text style={{ color: COLORS.primary, ...FONTS.h3 }}>
                {" - " + getFormattedDateWithYear(endDate, 0)}
              </Text>
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
              marginTop: 15,
              marginBottom: 3 * SIZES.padding,
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
              <Text
                key={index}
                style={{
                  marginTop: 5,
                  marginLeft: 10,
                  color: COLORS.primary,
                  ...FONTS.h3,
                }}
              >
                {index + 1}. {item.label}
                {" : "}
                <Text style={{ color: COLORS.red2 }}>
                  ₹{formatAmountWithCommas(item.sum)}
                </Text>
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
                ₹{formatAmountWithCommas(cumulativeExpenditure)}
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

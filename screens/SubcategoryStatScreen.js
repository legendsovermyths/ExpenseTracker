import React from "react";
import { View, Text, Image, ScrollView, TouchableOpacity } from "react-native";
import { COLORS, FONTS, SIZES, icons, PRETTYCOLORS } from "../constants";
import PieChartWithLegend from "../components/PieChartWithLegend";
import { getFormattedDateWithYear } from "../services/Utils";
import { StyleSheet } from "react-native"; // ⬅ add to imports
import {
  getTransactionsGroupedBySubategories,
  getNumberOfSubcategoryTransactionsBetweenDates,
  getNumberOfDays,
  formatAmountWithCommas,
} from "../services/_Utils";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useExpensifyStore } from "../store/store";
import { Icon } from "react-native-elements";
const ExpenditureCard = ({ index, label, amount }) => (
  <View style={styles.card}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.amount}>₹{formatAmountWithCommas(amount)}</Text>
  </View>
);
const SubcategoryStatScreen = () => {
  route = useRoute();
  const categoryObject = route.params.category;
  const categoryId = categoryObject.id;
  const category = categoryObject.name;
  const percentage = route.params.percentage;
  const startDate = new Date(route.params.startDate);
  const endDate = new Date(route.params.endDate);
  const edDate = new Date(endDate);
  edDate.setDate(endDate.getDate() + 1);
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
                      subcategoryIds: item.subcategory_id
                        ? [item.subcategory_id]
                        : null,
                    },
                  });
                }}
              >
                <View
                  key={item.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
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
                      size={23}
                      color={COLORS.lightBlue}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 0 }}>
                    <Text style={{ color: COLORS.primary, ...FONTS.h4 }}>
                      {item.label}
                    </Text>
                  </View>
                  <View style={{ marginRight: SIZES.padding / 2 }}>
                    <Text
                      style={{
                        color: !item.is_credit ? COLORS.red2 : COLORS.darkgreen,
                        ...FONTS.h3,
                      }}
                    >
                      ₹{formatAmountWithCommas(Math.abs(item.sum))}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
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
            <TouchableOpacity
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
              <Text
                style={{
                  marginLeft: 175,
                  marginBottom: 10,
                  color: COLORS.gray,
                  ...FONTS.body4,
                }}
              >
                {"View all Transactions>"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.lightGray,
    marginHorizontal: 10,
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    elevation: 2,
  },
  index: {
    width: 24,
    textAlign: "right",
    marginRight: 6,
    ...FONTS.h3,
    color: COLORS.darkgray,
  },
  label: {
    flex: 1,
    ...FONTS.h3,
    color: COLORS.primary,
  },
  amount: {
    ...FONTS.h3,
    color: COLORS.red2,
  },
});
export default SubcategoryStatScreen;

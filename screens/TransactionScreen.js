import { COLORS, FONTS, SIZES, icons } from "../constants";
import CustomFAB from "../components/CustomFAB";
import TransactionsList from "../components/TransactionList";
import { DataContext } from "../contexts/DataContext";
import HorizontalSnapList from "../components/HorizontalSnapList";
import { barGraph } from "../components/BarGraph";
import { StyleSheet, View, Text, Image, TouchableOpacity } from "react-native";
import { useContext, useState } from "react";
import {
  formatAmountWithCommas,
  getBarData,
  getTopCategoriesData,
} from "../services/Utils";
import { useNavigation } from "@react-navigation/native";
import { useExpensifyStore } from "../store/store";

const TransactionScreen = () => {
  const transactionById = useExpensifyStore((state) => state.transactions);
  const transactions = Object.values(transactionById);
  console.log(transactions);
  const [selectedView, setSelectedView] = useState(2);
  const navigation = useNavigation();
  const currentMonthTransactions = transactions.filter((transaction) => {
    const transactionDate = new Date(transaction.date_time);
    const currentDate = new Date();
    return (
      transactionDate.getMonth() === currentDate.getMonth() &&
      transactionDate.getFullYear() === currentDate.getFullYear()
    );
  });
  const lastMonthTransactions = transactions.filter((transaction) => {
    const transactionDate = new Date(transaction.date_time);
    const currentDate = new Date();
    return (
      transactionDate.getMonth() === currentDate.getMonth() - 1 &&
      transactionDate.getFullYear() === currentDate.getFullYear()
    );
  });
  console.log(lastMonthTransactions);
  const topCategoriesData = getTopCategoriesData(
    currentMonthTransactions,
    lastMonthTransactions,
  );
  const featuredCardData = [...topCategoriesData];
  const totalExpenditure = currentMonthTransactions.reduce(
    (total, transaction) => {
      if (transaction.is_credit === false) {
        return total + Number(transaction.amount);
      }
      return total;
    },
    0,
  );

  const initialBalance = 100000;
  const totalCashFlow = currentMonthTransactions.reduce(
    (total, transaction) => {
      if (transaction.is_credit === false) {
        return total + Number(transaction.amount);
      }
      return total;
    },
    0,
  );
  const totalBalance = initialBalance - totalCashFlow;
  const handleBalanceEdit = () => {
    navigation.navigate("BalanceEditScreen");
  };
  currentMonthTransactions.sort((a, b) => {
    const dateA = new Date(a.date_time);
    const dateB = new Date(b.date_time);
    return dateB - dateA;
  });
  const { barData, average } = getBarData(currentMonthTransactions);

  const handleIconPress = (view) => {
    setSelectedView(view);
  };
  function reanderTransaction() {
    const today = new Date();
    const month = today.toLocaleString("default", { month: "long" });
    return (
      <View
        style={{
          paddingHorizontal: SIZES.padding,
          paddingTop: (5 * SIZES.padding) / 2,
          backgroundColor: COLORS.white,
        }}
      >
        <View>
          <Text
            style={{
              marginLeft: SIZES.padding / 6,
              color: COLORS.primary,
              ...FONTS.h1,
            }}
          >
            {month}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: SIZES.padding,
          }}
        >
          <View
            style={{
              flex: 1,
              marginRight: SIZES.padding / 5,
              marginBottom: 5,
            }}
          >
            <View
              style={{
                backgroundColor: COLORS.lightGray,
                borderRadius: 10,
                padding: SIZES.padding,
                elevation: 3,
              }}
            >
              <Text style={{ ...FONTS.h3, color: COLORS.darkgray }}>
                Expenditures
              </Text>
              <Text style={{ ...FONTS.h2, color: COLORS.red2 }}>
                ₹{formatAmountWithCommas(totalExpenditure, false)}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={{ flex: 1, marginLeft: SIZES.padding / 5 }}
            onPress={handleBalanceEdit}
          >
            <View>
              <View
                style={{
                  backgroundColor: COLORS.lightGray,
                  borderRadius: 10,
                  padding: SIZES.padding,
                  elevation: 3,
                }}
              >
                <Text style={{ ...FONTS.h3, color: COLORS.darkgray }}>
                  Balance
                </Text>
                <Text
                  style={{
                    ...FONTS.h2,
                    color: totalBalance > 0 ? COLORS.darkgreen : COLORS.red2,
                  }}
                >
                  ₹{formatAmountWithCommas(totalBalance, false)}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.container}>
          <Text style={styles.text}>
            {selectedView == 1 ? "Activity" : "Summary"}
          </Text>
          <View style={styles.iconsContainer}>
            <TouchableOpacity
              onPress={() => handleIconPress(2)}
              style={[
                styles.iconWrapper,
                selectedView === 2 && styles.selectedIcon,
              ]}
            >
              <Image
                source={icons.baricon}
                style={styles.icon}
                tintColor={selectedView == 2 ? COLORS.white : COLORS.darkgray}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleIconPress(1)}
              style={[
                styles.iconWrapper,
                selectedView === 1 && styles.selectedIcon,
              ]}
            >
              <Image
                source={icons.menu}
                style={styles.icon}
                tintColor={selectedView == 1 ? COLORS.white : COLORS.darkgray}
              />
            </TouchableOpacity>
          </View>
        </View>
        {selectedView == 1 ? (
          <TransactionsList
            currentMonthTransactions={currentMonthTransactions}
          />
        ) : (
          <View>
            <View
              style={{
                backgroundColor: COLORS.lightGray,
                padding: 5,
                borderRadius: 10,
                marginTop: SIZES.padding / 4,
              }}
            >
              <Text
                style={{
                  marginTop: 10,
                  marginLeft: 10,
                  color: COLORS.red2,
                  ...FONTS.h2,
                }}
              >
                ₹{formatAmountWithCommas(average, false)}
              </Text>
              <Text
                style={{
                  marginBottom: 10,
                  marginLeft: 10,
                  color: COLORS.darkgray,
                  ...FONTS.body4,
                }}
              >
                Daily average (last 7 days)
              </Text>
              {barGraph(barData, average)}
            </View>
            <View style={{ marginTop: 10 }}>
              <HorizontalSnapList data={featuredCardData} />
            </View>
          </View>
        )}
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.lightGray2 }}>
      {/* Header section */}
      {reanderTransaction()}
      {selectedView == 1 ? <CustomFAB /> : null}
    </View>
  );
};
const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  text: {
    ...FONTS.h2,
    color: COLORS.darkgray,
  },
  iconsContainer: {
    flexDirection: "row",
  },
  iconWrapper: {
    marginLeft: 10,
    padding: 8,
    borderRadius: 50,
  },
  selectedIcon: {
    backgroundColor: COLORS.secondary,
  },
  icon: {
    width: 17,
    height: 17,
  },
});

export default TransactionScreen;

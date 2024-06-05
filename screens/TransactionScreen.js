import { COLORS, FONTS, SIZES, icons, images } from "../constants";
import { Icon } from "@rneui/themed";
import CustomFAB from "../components/CustomFAB";
import TransactionsList from "../components/TransactionList";
import { DataContext } from "../contexts/DataContext";
import { BarChart } from "react-native-gifted-charts";
import HorizontalSnapList from "../components/HorizontalSnapList";
import {
  SafeAreaView,
  StyleSheet,
  ScrollView,
  View,
  Text,
  StatusBar,
  Image,
  ImageBackground,
  TouchableOpacity,
  FlatList,
  Animated,
  Platform,
} from "react-native";
import { useContext, useState } from "react";
import { formatAmountWithCommas, getBarData, getSubscriptionsDueInNext15Days, getTopCategoriesData } from "../services/Utils";
import { useNavigation } from "@react-navigation/native";

const barGraph = (barData, average) => {
  return (
    <View>
      <BarChart
        yAxisTextStyle={{ color: COLORS.primary, ...FONTS.body4 }}
        xAxisLabelTextStyle={{color:COLORS.primary}}
        barWidth={20}
        formatYLabel={(amount) => {
          amount = Number(amount);
          if (amount >= 1000000000) {
            return (amount / 1000000000).toFixed(2) + "b";
          } else if (amount >= 1000000) {
            return (amount / 1000000).toFixed(2) + "m";
          } else if (amount >= 1000) {
            return (amount / 1000).toFixed(1) + "k";
          } else {
            return amount.toString();
          }
        }}
        noOfSections={3}
        barBorderRadius={4}
        frontColor={COLORS.darkgray}
        data={barData}
        yAxisThickness={0}
        xAxisThickness={0}
        hideRules
        showReferenceLine1
        yAxisExtraHeight={20}
        height={180}
        referenceLine1Position={average}
        referenceLine1Config={{
          color: "gray",
          dashWidth: 2,
          dashGap: 3,
        }}
        renderTooltip={(item, index) => {
          return (
            <View
              style={{
                marginLeft: item.value>999?-15:-6,
                backgroundColor: COLORS.lightGray2,
                borderRadius: 4,
              }}
            >
              <Text>₹{formatAmountWithCommas(item.value)}</Text>
            </View>
          );
        }}
      />
    </View>
  );
};

const TransactionScreen = () => {
  const { transactions, subscriptions, constants } =
    useContext(DataContext);
  const [selectedView, setSelectedView] = useState(2);
  const navigation = useNavigation();
  const currentMonthTransactions = transactions.filter((transaction) => {
    const transactionDate = new Date(transaction.date);
    const currentDate = new Date();
    return (
      transactionDate.getMonth() === currentDate.getMonth() &&
      transactionDate.getFullYear() === currentDate.getFullYear()
    );
  });
  const lastMonthTransactions = transactions.filter((transaction) => {
    const transactionDate = new Date(transaction.date);
    const currentDate = new Date();
    return (
      transactionDate.getMonth() === (currentDate.getMonth()-1) &&
      transactionDate.getFullYear() === currentDate.getFullYear()
    );
  });
  const topCategoriesData=getTopCategoriesData(currentMonthTransactions, lastMonthTransactions)
  const currentMonthSubscriptionsFlatListData=getSubscriptionsDueInNext15Days(subscriptions)
  const featuredCardData = [...topCategoriesData, ...currentMonthSubscriptionsFlatListData]
  const totalExpenditure = currentMonthTransactions.reduce(
    (total, transaction) => {
      if (transaction.on_record === 1 && transaction.amount < 0) {
        return total - Number(transaction.amount);
      }
      return total;
    },
    0
  );

  const initialBalance = constants.find(
    (item) => item.name === "balance"
  )?.value;
  const totalCashFlow = currentMonthTransactions.reduce(
    (total, transaction) => {
      if (transaction.on_record === 1) {
        return total - Number(transaction.amount);
      }
      return total;
    },
    0
  );
  const totalBalance = initialBalance - totalCashFlow;
  const handleBalanceEdit = () => {
    navigation.navigate("BalaceEditScreen");
  };
  currentMonthTransactions.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB - dateA;
  });
  const { barData, average } = getBarData(currentMonthTransactions);
  const [selectedIcon, setSelectedIcon] = useState(null);

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
                ₹{formatAmountWithCommas(totalExpenditure)}
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
                  ₹{formatAmountWithCommas(totalBalance)}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.container}>
          <Text style={styles.text}>
            {selectedView == 1 ? "Transactions" : "Summary"}
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
                ₹{formatAmountWithCommas(average)}
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
            <View>
            <HorizontalSnapList data={featuredCardData}/>
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
      {selectedView==1?(<CustomFAB />):null}
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

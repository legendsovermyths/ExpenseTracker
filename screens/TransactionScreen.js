import { COLORS, FONTS, SIZES, icons } from "../constants";
import CustomFAB from "../components/CustomFAB";
import TransactionsList from "../components/TransactionList";
import HorizontalSnapList from "../components/HorizontalSnapList";
import { barGraph } from "../components/BarGraph";
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  Dimensions,
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import { useState, useRef } from "react";
import {
  formatAmountWithCommas,
  getTopCategoriesData,
} from "../services/Utils";

import { getBarData } from "../services/_Utils";
import { useNavigation } from "@react-navigation/native";
import { useExpensifyStore } from "../store/store";
import { filterTransactions, getMonthRange } from "../services/_Utils";
const width = 345;
const TransactionScreen = () => {
  const transactionById = useExpensifyStore((state) => state.transactions);
  const initialBalance = parseInt(
    useExpensifyStore((state) => state.getAppconstantByKey("balance")).value,
  );
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [open, setOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState("weekly");
  const [items, setItems] = useState([
    { label: "Weekly", value: "weekly" },
    { label: "Monthly", value: "monthly" },
  ]);
  const categoriesById = useExpensifyStore((state) => state.categories);
  const transactions = Object.values(transactionById);
  const [selectedView, setSelectedView] = useState(1);
  const navigation = useNavigation();
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const currentMonthIndex = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const { firstDate, lastDate } = getMonthRange(year, month);
  const transactionFilter = {
    startDate: firstDate.toISOString(),
    endDate: lastDate.toISOString(),
  };
  const currentMonthTransactions = filterTransactions(
    transactions,
    transactionFilter,
  );

  const flatListRef = useRef(null);

  const monthsData = Array.from({ length: 100 }, (_, index) => {
    const monthIndex = (currentMonthIndex - index + 12) % 12;
    const yearOffset = Math.floor((currentMonthIndex - index) / 12);
    return {
      month: months[monthIndex],
      year: currentYear + yearOffset,
      key: `${monthIndex}-${yearOffset}`,
    };
  });

  const handleScrollEnd = (event) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    const selectedYear = monthsData[index].year;

    const selectedMonthIndex =
      index === 0
        ? new Date().getMonth()
        : months.findIndex((m) => m === monthsData[index].month);

    setYear(selectedYear);
    setMonth(selectedMonthIndex);
  };

  const lastMonthTransactions =
    month == currentMonthIndex
      ? transactions.filter((transaction) => {
        const transactionDate = new Date(transaction.date_time);
        const currentDate = new Date();
        return (
          transactionDate.getMonth() === currentDate.getMonth() - 1 &&
          transactionDate.getFullYear() === currentDate.getFullYear()
        );
      })
      : [];
  const topCategoriesData = getTopCategoriesData(
    currentMonthTransactions,
    lastMonthTransactions,
    categoriesById,
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
  const { barData, average } = getBarData(
    currentMonthTransactions,
    selectedOption,
    month,
    year,
  );

  const handleIconPress = (view) => {
    setSelectedView(view);
  };
  function reanderTransaction() {
    return (
      <View
        style={{
          paddingHorizontal: SIZES.padding,
          paddingTop: (5 * SIZES.padding) / 2,
          backgroundColor: COLORS.white,
        }}
      >
        <View>
          <FlatList
            ref={flatListRef}
            horizontal
            inverted
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            data={monthsData}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => (
              <View
                style={{
                  width: width,
                }}
              >
                <Text
                  style={{
                    marginLeft: SIZES.padding / 6,
                    color: COLORS.primary,
                    ...FONTS.h1,
                  }}
                >
                  {item.month}
                </Text>
              </View>
            )}
            onMomentumScrollEnd={handleScrollEnd}
            initialScrollIndex={0}
            getItemLayout={(_, index) => ({
              length: width,
              offset: width * index,
              index,
            })}
          />
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: (3 * SIZES.padding) / 4,
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
              <View
                style={{
                  flexDirection: "row",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <View>
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
                    {"Daily average" +
                      (selectedOption === "weekly" ? "(last 7 days)" : "")}
                  </Text>
                </View>
                <DropDownPicker
                  showTickIcon={false}
                  open={open}
                  value={selectedOption}
                  items={items}
                  setOpen={setOpen}
                  setValue={setSelectedOption}
                  setItems={setItems}
                  dropDownDirection="TOP"
                  zIndex={1000}
                  style={{
                    width: 105,
                    borderColor: COLORS.lightGray,
                    borderRadius: 5,
                    backgroundColor: COLORS.lightGray,
                  }}
                  textStyle={{ color: COLORS.darkgray, ...FONTS.body4 }}
                  containerStyle={{ width: 100 }}
                  dropDownContainerStyle={{
                    backgroundColor: COLORS.lightGray,
                    borderColor: COLORS.lightGray,
                  }}
                />
              </View>
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

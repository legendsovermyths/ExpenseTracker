import { COLORS, FONTS, SIZES, icons, images } from "../constants";
import CustomFAB from "../components/CustomFAB";
import TransactionsList from "../components/TransactionList";
import { DataContext } from "../contexts/DataContext";

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
import { formatAmountWithCommas } from "../services/Utils";
import { useNavigation } from "@react-navigation/native";

const TransactionScreen = () => {
  const { transactions, updateTransactions, constants } = useContext(DataContext);
  const {displayGraph, setDisplayGraph} = useState(1);
  const navigation=useNavigation();
  const currentMonthTransactions = transactions.filter((transaction) => {
    const transactionDate = new Date(transaction.date);
    const currentDate = new Date();
    return (
      transactionDate.getMonth() === currentDate.getMonth() &&
      transactionDate.getFullYear() === currentDate.getFullYear()
    );
  });
  const totalExpenditure = currentMonthTransactions.reduce(
    (total, transaction) => {
      if (transaction.on_record === 1 && transaction.amount < 0) {
        return total - Number(transaction.amount);
      }
      return total;
    },
    0
  );

  const initialBalance = constants.find(item => item.name === 'balance')?.value;
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
  const handleBalanceEdit=()=>{
    navigation.navigate('BalaceEditScreen')
  }
  currentMonthTransactions.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB - dateA;
  });
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
          <View style={{ flex: 1, marginRight: SIZES.padding / 5, marginBottom:15 }}>
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
          <TouchableOpacity style={{ flex: 1, marginLeft: SIZES.padding / 5 }} onPress={handleBalanceEdit}>
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
        <TransactionsList currentMonthTransactions={currentMonthTransactions} displayGraph={1} />
        
      </View>
    );
  }
  return (
    
    <View style={{ flex: 1, backgroundColor: COLORS.lightGray2 }}>
      {/* Header section */}
      {reanderTransaction()}
      <CustomFAB />
    </View>
  );
};

export default TransactionScreen;

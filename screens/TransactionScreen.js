import { COLORS, FONTS, SIZES, icons, images } from "../constants";
import CustomFAB from "../components/CustomFAB";
import TransactionsList from "../components/TransactionList";
import { DataContext } from "../contexts/DataContext";
// import { BarChart } from "react-native-gifted-charts";
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
import { useContext } from "react";
import { formatAmountWithCommas } from "../services/Utils";
import { useNavigation } from "@react-navigation/native";
// const barGraph=()=>{
//   const barData = [
//     {value: 230,label: 'Mon',frontColor: '#4ABFF4'},
//     {value: 180,label: 'Tue',frontColor: '#79C3DB'},
//     {value: 195,label: 'Wed',frontColor: '#28B2B3'},
//     {value: 250,label: 'Thur',frontColor: '#4ADDBA'},
//     {value: 320,label: 'Fri',frontColor: '#91E3E3'},
//     {value: 250,label: 'Sat',frontColor: '#4ADDBA'},
//     {value: 250,label: 'Sun',frontColor: '#79C3DB'},
//     ];
//     return (
//         <View>
//             <BarChart
//             hideYAxisText={true}
//             noOfSections={3}
//             maxValue={400}
//             data={barData}
//             isAnimated
//             width={400}
//             barWidth={25}
//             hideRules
//             yAxisThickness={0}
//             barBorderRadius={4}
//             xAxisThickness={0}
//             initialSpacing={3}
//             spacing={25}
//             height={150}
//             />
//         </View>

//     );
// }
const TransactionScreen = () => {
  const { transactions, updateTransactions, constants } = useContext(DataContext);
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

  const initialBalance = constants.find(item => item.name === 'balance')?.value;;
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
  function reanderTransaction() {
    const today = new Date();
    const month = today.toLocaleString("default", { month: "long" });
    return (
      <View
        style={{
          paddingHorizontal: SIZES.padding,
          paddingVertical: (5 * SIZES.padding) / 2,
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
          <View style={{ flex: 1, marginRight: SIZES.padding / 5 }}>
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
        <View>
          <Text
            style={{
              ...FONTS.h2,
              color: COLORS.darkgray,
              paddingTop: SIZES.padding / 4,
            }}
          >
            Transactions
          </Text>
        </View>
        <TransactionsList />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.lightGray2 }}>
      {/* Header section */}
      {reanderTransaction()}
      {CustomFAB()}
    </View>
  );
};

export default TransactionScreen;

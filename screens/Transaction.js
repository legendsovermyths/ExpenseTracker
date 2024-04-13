import { COLORS, FONTS, SIZES, icons, images } from "../constants";
import CustomFAB from "../components/CustomFAB";
import TransactionsList from "../components/TransactionList";
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



const Transactions = () => {
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
          <Text style={{ marginLeft:SIZES.padding/6,color: COLORS.primary, ...FONTS.h1 }}>{month}</Text>
        </View>
        
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: SIZES.padding }}>
          <View style={{ flex: 1, marginRight: SIZES.padding / 2 }}>
            <View style={{ backgroundColor: COLORS.lightGray, borderRadius: 10, padding: SIZES.padding, elevation: 3 }}>
              <Text style={{ ...FONTS.h3, color: COLORS.darkgray }}>Expenditures</Text>
              <Text style={{ ...FONTS.h2, color: COLORS.red2 }}>₹2000</Text>
            </View>
          </View>
          <View style={{ flex: 1, marginLeft: SIZES.padding / 2 }}>
            <View style={{ backgroundColor: COLORS.lightGray, borderRadius: 10, padding: SIZES.padding, elevation: 3 }}>
              <Text style={{ ...FONTS.h3, color: COLORS.darkgray }}> Balance</Text>
              <Text style={{ ...FONTS.h2, color: COLORS.darkgreen }}>₹1500</Text>
            </View>
          </View>
        </View>
    
        <View>
          <Text style={{ ...FONTS.h2, color: COLORS.darkgray, paddingTop:SIZES.padding/4 }}>Transactions</Text>
        </View>
        <TransactionsList/>
        
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

export default Transactions;

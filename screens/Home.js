import { COLORS, FONTS, SIZES, icons, images } from "../constants";
import CustomFAB from "../components/CustomFAB";
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



const Home = () => {
  function renderHeader() {
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
              <Text style={{ ...FONTS.h2, color: COLORS.red2 }}>₹500</Text>
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
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: SIZES.padding }}>
          <View style={{ flex: 0.01, height: 1, backgroundColor: COLORS.lightGray }} />
          <Text style={{ color: COLORS.darkgray }}>9th April</Text>
          <View style={{ flex: 0.5, height: 1, backgroundColor: COLORS.lightGray }} />
        </View>
        <View style={{ flexDirection: "row", marginTop: SIZES.padding, alignItems: "center" }}>
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
            <Image source={icons.food} style={{ width: 20, height: 20, tintColor: COLORS.lightBlue }} />
          </View>
          <View style={{ flex: 1, marginLeft: SIZES.padding / 3 }}>
            <Text style={{ color: COLORS.primary, ...FONTS.h3 }}>Food with Friends</Text>
            <Text style={{ ...FONTS.body3, color: COLORS.darkgray }}>HDFC</Text>
          </View>
          <View style={{ marginLeft: SIZES.padding }}>
            <Text style={{ color: COLORS.red2, ...FONTS.h2 }}>₹500</Text>
          </View>
        </View>
        
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.lightGray2 }}>
      {/* Header section */}
      {renderHeader()}
      {CustomFAB()}
    </View>
  );
};

export default Home;

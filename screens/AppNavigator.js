import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import TransactionScreen from "./TransactionScreen";
import BankScreen from "./BankScreen";
import SubscriptionScreen from "./SubscriptionScreen";
import { COLORS, FONTS, SIZES, icons, images } from "../constants";
import { createStackNavigator } from "@react-navigation/stack";
import TransactionInputScreen from "./TransactionInputScreen";
import InputScreenNavigator from "../navigation/InputScreenNavigator";
const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
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

const HomeScreensNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconSource;
          if (route.name === "Transactions") {
            iconSource = icons.transfer_money;
          } else if (route.name === "Banks") {
            iconSource = icons.bank2;
          } else if (route.name === "Subscriptions") {
            iconSource = icons.subscription;
          }
          return (
            <Image
              source={iconSource}
              style={{ width: 25, height: 25, tintColor: color }}
            />
          );
        },
        headerShown: false,
        tabBarHideOnKeyboard: true,
      })}
      tabBarOptions={{
        activeTintColor: COLORS.primary,
        inactiveTintColor: COLORS.darkgray,
      }}
    >
      <Tab.Screen name="Transactions" component={TransactionScreen} />
      <Tab.Screen name="Banks" component={BankScreen} />
      <Tab.Screen name="Subscriptions" component={SubscriptionScreen} />
    </Tab.Navigator>
  );
};
const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        presentation="modal"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Main" component={HomeScreensNavigator} />
        <Stack.Screen name="InputScreen" component={InputScreenNavigator} />
        <Stack.Screen name="TransactionEdit" component={TransactionInputScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;

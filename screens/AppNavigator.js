import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import TransactionScreen from "./TransactionScreen";
import BankScreen from "./BankScreen";
import SubscriptionScreen from "./SubscriptionScreen";
import { COLORS, FONTS, SIZES, icons, images } from "../constants";
import { createStackNavigator } from "@react-navigation/stack";
import TransactionInputScreen from "./TransactionInputScreen";
import StatsScreen from "./StatisticsScreen";
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
import BalaceEditScreen from "./BalanceEditScreen";
import TransactionsBetweenDatesScreen from "./TransactionsBetweenDatesScreen";
import BankInputScreen from "./BankInputScreen";
import SubscriptionInputScreen from "./SubscriptionInputScreen";
import CategoryInputScreen from "./CategoryInputScreen";
import SettingsScreen from "./SettingsScreen";
import SubcategoryStatScreen from "./SubcategoryStatScreen";

const HomeScreensNavigator = () => {
  return (
    <Tab.Navigator
      initialRouteName="Transactions"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconSource;
          if (route.name === "Transactions") {
            iconSource = icons.transfer_money;
          } else if (route.name === "Banks") {
            iconSource = icons.bank2;
          } else if (route.name === "Subscriptions") {
            iconSource = icons.subscription;
          } else if (route.name == "Statistics") {
            iconSource = icons.bar_chart;
          } else if (route.name == "Settings") {
            iconSource = icons.setting;
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
      <Tab.Screen name="Banks" component={BankScreen} />
      <Tab.Screen name="Subscriptions" component={SubscriptionScreen} />
      <Tab.Screen name="Transactions" component={TransactionScreen} />
      <Tab.Screen name="Statistics" component={StatsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
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
        <Stack.Screen
          name="AddTransaction"
          component={TransactionInputScreen}
        />
        <Stack.Screen name="AddBank" component={BankInputScreen} />
        <Stack.Screen
          name="TransactionEdit"
          component={TransactionInputScreen}
        />
        <Stack.Screen
          name="AddSubscription"
          component={SubscriptionInputScreen}
        />
        <Stack.Screen name="BalaceEditScreen" component={BalaceEditScreen} />
        <Stack.Screen
          name="TransactionsBetweenDates"
          component={TransactionsBetweenDatesScreen}
        />
        <Stack.Screen name="AddCategory" component={CategoryInputScreen} />
        <Stack.Screen
          name="SubcategoryStat"
          component={SubcategoryStatScreen}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;

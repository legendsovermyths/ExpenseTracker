import React from "react";
import { Image } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { icons } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { createStackNavigator } from "@react-navigation/stack";
import TransactionScreen from "./TransactionScreen";
import BankScreen from "./BankScreen";
import DashboardScreen from "./DashboardScreen";
import StatsScreen from "./StatisticsScreen";
import SettingsScreen from "./SettingsScreen";
import TransactionInputScreen from "./TransactionInputScreen";
import BankInputScreen from "./BankInputScreen";
import CategoryInputScreen from "./CategoryInputScreen";
import CategoryEditScreen from "./CategoryEditScreen";
import BalanceEditScreen from "./BalanceEditScreen";
import ProfileDetailScreen from "./ProfileDetail";
import SubcategoryStatScreen from "./SubcategoryStatScreen";
import UserSearchScreen from "./SearchPeople";
import SplitInputScreen from "./AddSplitScreen";
import BalancesScreen from "./BalanceScreen";
import FriendLedgerScreen from "./FriendLedgerScreen";
import SettleScreen from "./SettleScreen";
import SplitSummaryScreen from "./SplitSummary";
import FilteredTransaction from "./FilteredTransaction";
import ExpenditureReportsScreen from "./ExpenditureReportsScreen";
import AppearanceScreen from "./AppearanceScreen";
import CategoryBudgetScreen from "./CategoryBudgetScreen";
// Define types for root stack
export type RootStackParamList = {
  Profile: undefined;
  SignUp: { name: string; phone: string };
  OTPScreen: { name: string; phone: string; email: string };
  Main: undefined;
  AddTransaction: undefined;
  AddTransfer: undefined;
  AddBank: undefined;
  TransactionEdit: undefined;
  ViewCategory: undefined;
  TransactionsBetweenDates: undefined;
  AddCategory: undefined;
  EditCategory: undefined;
  SubcategoryStat: undefined;
  BalanceEdit: undefined;
  SearchPeople: undefined;
  ExpenditureReports: undefined;
};

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
// Tab Navigator for main screens
function HomeTabs() {
  const { COLORS } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.darkgray,
        tabBarStyle: { backgroundColor: COLORS.white },
        tabBarIcon: ({ color }) => {
          const source =
            route.name === "Balances"
              ? icons.bill
              : route.name === "Transactions"
                ? icons.transfer_money
                : route.name === "Home"
                  ? icons.home
                  : route.name === "Analysis"
                    ? icons.bar_chart
                    : icons.setting;
          return (
            <Image
              source={source}
              style={{ width: 24, height: 24, tintColor: color }}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Balances" component={BalancesScreen} />
      <Tab.Screen name="Transactions" component={TransactionScreen} />
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Analysis" component={StatsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

// Root Stack Navigator
export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={HomeTabs} />

      <Stack.Screen name="Banks" component={BankScreen} />
      <Stack.Screen name="AddTransaction" component={TransactionInputScreen} />
      <Stack.Screen name="AddBank" component={BankInputScreen} />
      <Stack.Screen name="TransactionEdit" component={TransactionInputScreen} />
      <Stack.Screen name="ViewCategory" component={CategoryEditScreen} />
      <Stack.Screen
        name="FilteredTransaction"
        component={FilteredTransaction}
      />
      <Stack.Screen name="FriendLedgerScreen" component={FriendLedgerScreen} />
      <Stack.Screen name="AddCategory" component={CategoryInputScreen} />
      <Stack.Screen name="EditCategory" component={CategoryInputScreen} />
      <Stack.Screen name="SubcategoryStat" component={SubcategoryStatScreen} />
      <Stack.Screen name="BalanceEditScreen" component={BalanceEditScreen} />
      <Stack.Screen name="ProfileDetail" component={ProfileDetailScreen} />
      <Stack.Screen name="SearchPeople" component={UserSearchScreen} />
      <Stack.Screen name="SettleScreen" component={SettleScreen} />
      <Stack.Screen name="SplitInputScreen" component={SplitInputScreen} />
      <Stack.Screen name="SplitSummary" component={SplitSummaryScreen} />
      <Stack.Screen name="ExpenditureReports" component={ExpenditureReportsScreen} />
      <Stack.Screen name="Appearance" component={AppearanceScreen} />
      <Stack.Screen name="CategoryBudgets" component={CategoryBudgetScreen} />
    </Stack.Navigator>
  );
}

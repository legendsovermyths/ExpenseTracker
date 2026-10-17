import React from "react";
import { StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator, NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { FONT } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { Icon, PresentationContext, haptic } from "../components/ui";
import type { Presentation } from "../components/ui";
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
import MyQRCodeScreen from "./MyQRCodeScreen";
import ScanFriendQRScreen from "./ScanFriendQRScreen";
import SharedImageScreen from "./SharedImageScreen";
import SplitPartnerScreen from "./SplitPartnerScreen";
import CreateFundScreen from "./CreateFundScreen";
import FundDetailScreen from "./FundDetailScreen";
import FundContributorScreen from "./FundContributorScreen";
import AddFundEntryScreen from "./AddFundEntryScreen";
import CreateGroupScreen from "./CreateGroupScreen";
import GroupDetailScreen from "./GroupDetailScreen";
import AddGroupExpenseScreen from "./AddGroupExpenseScreen";
import GroupExpenseSummaryScreen from "./GroupExpenseSummaryScreen";
import AttachmentViewerScreen from "./AttachmentViewerScreen";
import DocumentsScreen from "./DocumentsScreen";
import DesignSystemScreen from "./DesignSystemScreen";
// Define types for root stack. Params are `undefined` for screens that take
// none; screens that read `route.params` use `useRoute()` locally. Keep this in
// sync with the <Stack.Screen> names registered in AppNavigator below.
export type RootStackParamList = {
  Profile: undefined;
  SignUp: { name: string; phone: string };
  OTPScreen: { name: string; phone: string; email: string };
  Main: undefined;
  Banks: undefined;
  AddTransaction: undefined;
  AddTransfer: undefined;
  AddBank: undefined;
  TransactionEdit: undefined;
  ViewCategory: undefined;
  TransactionsBetweenDates: undefined;
  FilteredTransaction: undefined;
  FriendLedgerScreen: undefined;
  AddCategory: undefined;
  EditCategory: undefined;
  SubcategoryStat: undefined;
  BalanceEdit: undefined;
  BalanceEditScreen: undefined;
  ProfileDetail: undefined;
  SearchPeople: undefined;
  SettleScreen: undefined;
  SplitInputScreen: undefined;
  SplitSummary: undefined;
  MyQRCode: undefined;
  ScanFriendQR: undefined;
  ExpenditureReports: undefined;
  Appearance: undefined;
  CategoryBudgets: undefined;
  SharedImage: undefined;
  SplitPartner: undefined;
  CreateFundScreen: undefined;
  FundDetailScreen: undefined;
  FundContributorScreen: undefined;
  AddFundEntryScreen: undefined;
  CreateGroupScreen: undefined;
  GroupDetail: undefined;
  AddGroupExpense: undefined;
  GroupExpenseSummary: undefined;
  AttachmentViewer: undefined;
  Documents: undefined;
  DesignSystem: undefined;
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_ICONS: Record<string, [string, string]> = {
  Balances: ["account-multiple-outline", "account-multiple"],
  Transactions: ["swap-vertical-circle-outline", "swap-vertical-circle"],
  Home: ["home-variant-outline", "home-variant"],
  Analysis: ["chart-box-outline", "chart-box"],
  Settings: ["cog-outline", "cog"],
};

// Flat iOS-style tab bar: outline icons that fill when active, accent tint,
// hairline top edge, selection haptic on switch.
function HomeTabs() {
  const { COLORS } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenListeners={{ tabPress: () => haptic("selection") }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.inkSubtle,
        tabBarStyle: {
          backgroundColor: COLORS.paper,
          borderTopColor: COLORS.hairline,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
        },
        tabBarLabelStyle: { fontFamily: FONT.medium, fontSize: 10, letterSpacing: 0.1 },
        tabBarIcon: ({ color, focused }) => {
          const [outline, filled] = TAB_ICONS[route.name] ?? ["circle-outline", "circle"];
          return <Icon name={focused ? filled : outline} size={25} color={color} />;
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

// Modal screens get their own providers: bottom sheets would otherwise render
// behind the native modal, and safe-area insets must be measured for the
// modal itself (0 top in a page sheet, the status bar when full screen).
const withSheets = <P extends object>(Component: React.ComponentType<P>, presentation: Presentation = "modal") => {
  const Wrapped = (props: P) => (
    <SafeAreaProvider>
      <BottomSheetModalProvider>
        <PresentationContext.Provider value={presentation}>
          <Component {...props} />
        </PresentationContext.Provider>
      </BottomSheetModalProvider>
    </SafeAreaProvider>
  );
  Wrapped.displayName = `withSheets(${Component.displayName ?? Component.name})`;
  return Wrapped;
};

// Form tiers (see docs/DESIGN.md). Until a screen migrates to the `Form`
// shell (which re-enables swipe-to-dismiss while clean), involved forms keep
// the gesture off so work can't be lost by an accidental swipe.
const INVOLVED_FORM: NativeStackNavigationOptions = { presentation: "modal", gestureEnabled: false };
const LIGHT_FORM: NativeStackNavigationOptions = { presentation: "modal" };

// The three money-entry flows are involved enough to be full pushed screens.
const AddTransaction = withSheets(TransactionInputScreen, "push");
const AddSplit = withSheets(SplitInputScreen, "push");
const AddGroupExpense = withSheets(AddGroupExpenseScreen, "push");
const CategoryInput = withSheets(CategoryInputScreen);
const SharedImage = withSheets(SharedImageScreen);
const BankInput = withSheets(BankInputScreen);
const BalanceEdit = withSheets(BalanceEditScreen);
const Settle = withSheets(SettleScreen);
const CreateFund = withSheets(CreateFundScreen);
const AddFundEntry = withSheets(AddFundEntryScreen);
const CreateGroup = withSheets(CreateGroupScreen);
const SplitPartner = withSheets(SplitPartnerScreen);

// Root stack. Headers are drawn by the screens themselves (Page / PageList /
// Form / LargeTitle) so every title sits on the same gutter.
export default function AppNavigator() {
  const { COLORS } = useTheme();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.paper } }}>
      <Stack.Screen name="Main" component={HomeTabs} />

      {/* Pages */}
      <Stack.Screen name="Banks" component={BankScreen} />
      <Stack.Screen name="FilteredTransaction" component={FilteredTransaction} />
      <Stack.Screen name="FriendLedgerScreen" component={FriendLedgerScreen} />
      <Stack.Screen name="SubcategoryStat" component={SubcategoryStatScreen} />
      <Stack.Screen name="ProfileDetail" component={ProfileDetailScreen} />
      <Stack.Screen name="SearchPeople" component={UserSearchScreen} />
      <Stack.Screen name="SplitSummary" component={SplitSummaryScreen} />
      <Stack.Screen name="ExpenditureReports" component={ExpenditureReportsScreen} />
      <Stack.Screen name="Appearance" component={AppearanceScreen} />
      <Stack.Screen name="CategoryBudgets" component={CategoryBudgetScreen} />
      <Stack.Screen name="FundDetailScreen" component={FundDetailScreen} />
      <Stack.Screen name="FundContributorScreen" component={FundContributorScreen} />
      <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
      <Stack.Screen name="GroupExpenseSummary" component={GroupExpenseSummaryScreen} />
      <Stack.Screen name="MyQRCode" component={MyQRCodeScreen} />
      <Stack.Screen name="ScanFriendQR" component={ScanFriendQRScreen} />
      <Stack.Screen name="Documents" component={DocumentsScreen} />
      <Stack.Screen name="ViewCategory" component={CategoryEditScreen} />
      <Stack.Screen
        name="AttachmentViewer"
        component={AttachmentViewerScreen}
        options={{ presentation: "fullScreenModal", animation: "fade" }}
      />
      {__DEV__ && (
        <Stack.Screen name="DesignSystem" component={DesignSystemScreen} />
      )}

      {/* Money entry — full pushed screens (swipe-back blocked while dirty) */}
      <Stack.Screen name="AddTransaction" component={AddTransaction} />
      <Stack.Screen name="TransactionEdit" component={AddTransaction} />
      <Stack.Screen name="SplitInputScreen" component={AddSplit} />
      <Stack.Screen name="AddGroupExpense" component={AddGroupExpense} />

      {/* Involved forms — full-height modal, dirty-guarded */}
      <Stack.Group screenOptions={INVOLVED_FORM}>
        <Stack.Screen name="AddCategory" component={CategoryInput} />
        <Stack.Screen name="EditCategory" component={CategoryInput} />
        <Stack.Screen name="SharedImage" component={SharedImage} />
      </Stack.Group>

      {/* Light forms — modal sheet, swipe to dismiss */}
      <Stack.Group screenOptions={LIGHT_FORM}>
        <Stack.Screen name="AddBank" component={BankInput} />
        <Stack.Screen name="BalanceEditScreen" component={BalanceEdit} />
        <Stack.Screen name="SettleScreen" component={Settle} />
        <Stack.Screen name="CreateFundScreen" component={CreateFund} />
        <Stack.Screen name="AddFundEntryScreen" component={AddFundEntry} />
        <Stack.Screen name="CreateGroupScreen" component={CreateGroup} />
        <Stack.Screen name="SplitPartner" component={SplitPartner} />
      </Stack.Group>
    </Stack.Navigator>
  );
}

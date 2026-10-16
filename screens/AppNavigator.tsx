import React from "react";
import { StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator, NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { FONT } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { Icon, haptic, formHeaderOptions, pageHeaderOptions } from "../components/ui";
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

// Each screen declares its own chrome via a static `nav` property, so screens
// can migrate independently without editing this file:
//   MyScreen.nav = { header: "page" };              // native large-title header
//   MyScreen.nav = { header: "page", large: false }; // compact native header
//   MyScreen.nav = { header: "form" };              // modal form header (useFormHeader)
// Screens without `nav` keep drawing their own header (legacy).
export interface ScreenNav {
  header?: "page" | "form" | "none";
  large?: boolean;
}
type NavComponent = React.ComponentType<any> & { nav?: ScreenNav };

const navFor = (C: NavComponent) => (): NativeStackNavigationOptions => {
  const nav = C.nav;
  if (!nav?.header || nav.header === "none") return {};
  return { headerShown: true, headerLargeTitle: nav.header === "page" ? nav.large ?? true : false };
};

// Bottom sheets inside a native modal must have their own provider, or they
// render behind the modal.
const withSheets = <P extends object>(Component: React.ComponentType<P> & { nav?: ScreenNav }) => {
  const Wrapped = (props: P) => (
    <BottomSheetModalProvider>
      <Component {...props} />
    </BottomSheetModalProvider>
  );
  Wrapped.displayName = `withSheets(${Component.displayName ?? Component.name})`;
  // Read lazily so `nav` assigned after import is still picked up.
  Object.defineProperty(Wrapped, "nav", { get: () => Component.nav });
  return Wrapped as typeof Wrapped & { nav?: ScreenNav };
};

// Form tiers (see UI plan §3). Until a screen migrates to `useFormHeader`
// (which re-enables swipe-to-dismiss when clean), involved forms keep the
// gesture off so work can't be lost by an accidental swipe.
const INVOLVED_FORM: NativeStackNavigationOptions = { presentation: "modal", gestureEnabled: false };
const LIGHT_FORM: NativeStackNavigationOptions = { presentation: "modal" };

const AddTransaction = withSheets(TransactionInputScreen);
const AddSplit = withSheets(SplitInputScreen);
const AddGroupExpense = withSheets(AddGroupExpenseScreen);
const CategoryInput = withSheets(CategoryInputScreen);
const SharedImage = withSheets(SharedImageScreen);
const BankInput = withSheets(BankInputScreen);
const BalanceEdit = withSheets(BalanceEditScreen);
const Settle = withSheets(SettleScreen);
const CreateFund = withSheets(CreateFundScreen);
const AddFundEntry = withSheets(AddFundEntryScreen);
const CreateGroup = withSheets(CreateGroupScreen);
const SplitPartner = withSheets(SplitPartnerScreen);

// Root Stack Navigator. Native headers are opt-in per screen as each one
// moves to the Paper & Ink kit — unmigrated screens still draw their own.
export default function AppNavigator() {
  const { COLORS, isDark } = useTheme();
  const page = pageHeaderOptions(COLORS, isDark);
  const form = formHeaderOptions(COLORS, isDark);

  return (
    <Stack.Navigator
      screenOptions={{
        ...page,
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.paper },
      }}
    >
      <Stack.Screen name="Main" component={HomeTabs} />

      {/* Pages */}
      <Stack.Screen name="Banks" component={BankScreen} options={navFor(BankScreen)} />
      <Stack.Screen name="FilteredTransaction" component={FilteredTransaction} options={navFor(FilteredTransaction)} />
      <Stack.Screen name="FriendLedgerScreen" component={FriendLedgerScreen} options={navFor(FriendLedgerScreen)} />
      <Stack.Screen name="SubcategoryStat" component={SubcategoryStatScreen} options={navFor(SubcategoryStatScreen)} />
      <Stack.Screen name="ProfileDetail" component={ProfileDetailScreen} options={navFor(ProfileDetailScreen)} />
      <Stack.Screen name="SearchPeople" component={UserSearchScreen} options={navFor(UserSearchScreen)} />
      <Stack.Screen name="SplitSummary" component={SplitSummaryScreen} options={navFor(SplitSummaryScreen)} />
      <Stack.Screen name="ExpenditureReports" component={ExpenditureReportsScreen} options={navFor(ExpenditureReportsScreen)} />
      <Stack.Screen name="Appearance" component={AppearanceScreen} options={navFor(AppearanceScreen)} />
      <Stack.Screen name="CategoryBudgets" component={CategoryBudgetScreen} options={navFor(CategoryBudgetScreen)} />
      <Stack.Screen name="FundDetailScreen" component={FundDetailScreen} options={navFor(FundDetailScreen)} />
      <Stack.Screen name="FundContributorScreen" component={FundContributorScreen} options={navFor(FundContributorScreen)} />
      <Stack.Screen name="GroupDetail" component={GroupDetailScreen} options={navFor(GroupDetailScreen)} />
      <Stack.Screen name="GroupExpenseSummary" component={GroupExpenseSummaryScreen} options={navFor(GroupExpenseSummaryScreen)} />
      <Stack.Screen name="MyQRCode" component={MyQRCodeScreen} options={navFor(MyQRCodeScreen)} />
      <Stack.Screen name="ScanFriendQR" component={ScanFriendQRScreen} options={navFor(ScanFriendQRScreen)} />
      <Stack.Screen name="Documents" component={DocumentsScreen} options={navFor(DocumentsScreen)} />
      <Stack.Screen name="ViewCategory" component={CategoryEditScreen} options={navFor(CategoryEditScreen)} />
      <Stack.Screen
        name="AttachmentViewer"
        component={AttachmentViewerScreen}
        options={{ presentation: "fullScreenModal", animation: "fade" }}
      />
      {__DEV__ && (
        <Stack.Screen name="DesignSystem" component={DesignSystemScreen} options={{ headerShown: true }} />
      )}

      {/* Involved forms — full-height modal, dirty-guarded */}
      <Stack.Group screenOptions={{ ...form, headerShown: false, ...INVOLVED_FORM }}>
        <Stack.Screen name="AddTransaction" component={AddTransaction} options={navFor(AddTransaction)} />
        <Stack.Screen name="TransactionEdit" component={AddTransaction} options={navFor(AddTransaction)} />
        <Stack.Screen name="SplitInputScreen" component={AddSplit} options={navFor(AddSplit)} />
        <Stack.Screen name="AddGroupExpense" component={AddGroupExpense} options={navFor(AddGroupExpense)} />
        <Stack.Screen name="AddCategory" component={CategoryInput} options={navFor(CategoryInput)} />
        <Stack.Screen name="EditCategory" component={CategoryInput} options={navFor(CategoryInput)} />
        <Stack.Screen name="SharedImage" component={SharedImage} options={navFor(SharedImage)} />
      </Stack.Group>

      {/* Light forms — modal sheet, swipe to dismiss */}
      <Stack.Group screenOptions={{ ...form, headerShown: false, ...LIGHT_FORM }}>
        <Stack.Screen name="AddBank" component={BankInput} options={navFor(BankInput)} />
        <Stack.Screen name="BalanceEditScreen" component={BalanceEdit} options={navFor(BalanceEdit)} />
        <Stack.Screen name="SettleScreen" component={Settle} options={navFor(Settle)} />
        <Stack.Screen name="CreateFundScreen" component={CreateFund} options={navFor(CreateFund)} />
        <Stack.Screen name="AddFundEntryScreen" component={AddFundEntry} options={navFor(AddFundEntry)} />
        <Stack.Screen name="CreateGroupScreen" component={CreateGroup} options={navFor(CreateGroup)} />
        <Stack.Screen name="SplitPartner" component={SplitPartner} options={navFor(SplitPartner)} />
      </Stack.Group>
    </Stack.Navigator>
  );
}

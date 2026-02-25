import { FONTS, SIZES, icons } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";
import CustomFAB from "../components/CustomFAB";
import TransactionsList from "../components/TransactionList";
import TransactionCard from "../components/TransactionCard";
import HorizontalSnapList from "../components/HorizontalSnapList";
import BarGraph from "../components/BarGraph";
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Modal,
  StatusBar,
  SafeAreaView,
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import { useState, useRef, useMemo } from "react";
import {
  formatAmountWithCommas,
  getTopCategoriesData,
} from "../services/Utils";
import { TextInput } from "react-native";
import { Icon } from "react-native-elements";
import { format } from "date-fns";

import { getBarData } from "../services/Utils";
import { useNavigation } from "@react-navigation/native";
import { useExpensifyStore } from "../store/store";
import { filterTransactions, getMonthRange } from "../services/Utils";

const getFormattedDate = (dateString) => {
  const today = new Date();
  const transactionDate = new Date(dateString);
  if (transactionDate.toDateString() === today.toDateString()) {
    return "Today";
  } else {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (transactionDate.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      const day = transactionDate.getDate();
      const monthIndex = transactionDate.getMonth();
      const month = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ][monthIndex];

      const suffix = (day) => {
        if (day === 1 || day === 21 || day === 31) return "st";
        if (day === 2 || day === 22) return "nd";
        if (day === 3 || day === 23) return "rd";
        return "th";
      };

      return `${day}${suffix(day)} ${month}`;
    }
  }
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - SIZES.padding * 2;

const TransactionScreen: React.FC = () => {
  const { COLORS, isDark } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
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
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
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
    const totalMonths = currentMonthIndex - index;
    const yearOffset = totalMonths < 0 ? Math.floor(totalMonths / 12) : 0;
    const monthIndex = ((totalMonths % 12) + 12) % 12;
    return {
      month: months[monthIndex],
      year: currentYear + yearOffset,
      key: `${monthIndex}-${yearOffset}`,
    };
  });

  const handleScrollEnd = (event) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
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

  const cumulativeExpenditure = currentMonthTransactions.reduce(
    (acc, transaction) =>
      transaction.is_credit ? acc : acc + transaction.amount,
    0,
  );

  const average = selectedOption === "weekly" ? initialBalance / 4 : initialBalance;

  const { barData } = getBarData(
    transactions,
    year,
    month,
    selectedOption,
    initialBalance,
  );

  const featuredCardData = getTopCategoriesData(
    currentMonthTransactions,
    lastMonthTransactions,
    categoriesById,
  );

  const handleSearchTextChange = (text: string) => {
    setSearchText(text);

    if (text.trim() === "") {
      setSearchResults([]);
      setSearchSuggestions([]);
      return;
    }

    const lowercaseSearch = text.toLowerCase();

    // Filter transactions
    const results = transactions
      .filter((transaction) => {
        const descriptionMatch = transaction.description
          ?.toLowerCase()
          .includes(lowercaseSearch);
        const amountMatch = transaction.amount.toString().includes(text);
        const categoryMatch = categoriesById[transaction.category_id]?.name
          ?.toLowerCase()
          .includes(lowercaseSearch);
        return descriptionMatch || amountMatch || categoryMatch;
      })
      .sort(
        (a, b) =>
          new Date(b.date_time).getTime() - new Date(a.date_time).getTime(),
      )
      .slice(0, 50);

    setSearchResults(results);

    // Generate suggestions
    const uniqueDescriptions = new Set(
      transactions
        .map((t) => t.description?.trim())
        .filter((d) => d && d.toLowerCase().includes(lowercaseSearch)),
    );
    setSearchSuggestions(
      Array.from(uniqueDescriptions)
        .slice(0, 5)
        .map((desc) => ({ text: desc })),
    );
  };

  const handleSuggestionPress = (suggestion: string) => {
    setSearchText(suggestion);
    handleSearchTextChange(suggestion);
  };

  const reanderTransaction = () => {
    return (
      <View style={styles.container}>
        {/* Header with Balance */}
        <View style={styles.headerSection}>
          <View style={styles.balanceCard}>
            <View style={styles.balanceHeader}>
              <Icon name="wallet" type="material-community" size={28} color={COLORS.primary} />
              <Text style={styles.balanceLabel}>Current Balance</Text>
            </View>
            <Text style={styles.balanceAmount}>₹{formatAmountWithCommas(initialBalance)}</Text>
          </View>

          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => setIsSearchModalVisible(true)}
          >
            <Icon name="magnify" type="material-community" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Month Selector */}
        <View style={styles.monthSelectorContainer}>
          <FlatList
            ref={flatListRef}
            data={monthsData}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.key}
            onMomentumScrollEnd={handleScrollEnd}
            renderItem={({ item }) => (
              <View style={styles.monthItem}>
                <Text style={styles.monthText}>{item.month}</Text>
                <Text style={styles.yearText}>{item.year}</Text>
              </View>
            )}
          />
        </View>

        {/* Expenditure Card */}
        <View style={styles.expenditureCard}>
          <View style={styles.expenditureRow}>
            <View style={styles.expenditureIconCircle}>
              <Icon name="chart-line" type="material-community" size={22} color={COLORS.white} />
            </View>
            <View style={styles.expenditureInfo}>
              <Text style={styles.expenditureLabel}>Total Expenditure</Text>
              <Text style={styles.expenditureAmount}>₹{formatAmountWithCommas(cumulativeExpenditure)}</Text>
            </View>
          </View>
          <View style={styles.transactionCount}>
            <Icon name="receipt" type="material-community" size={16} color={COLORS.darkgray} />
            <Text style={styles.transactionCountText}>
              {currentMonthTransactions.length} transactions
            </Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, selectedView === 1 && styles.activeTab]}
            onPress={() => setSelectedView(1)}
          >
            <Icon
              name="format-list-bulleted"
              type="material-community"
              size={20}
              color={selectedView === 1 ? COLORS.primary : COLORS.darkgray}
            />
            <Text style={[styles.tabText, selectedView === 1 && styles.activeTabText]}>
              Transactions
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, selectedView === 2 && styles.activeTab]}
            onPress={() => setSelectedView(2)}
          >
            <Icon
              name="chart-box"
              type="material-community"
              size={20}
              color={selectedView === 2 ? COLORS.primary : COLORS.darkgray}
            />
            <Text style={[styles.tabText, selectedView === 2 && styles.activeTabText]}>
              Summary
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {selectedView == 1 ? (
          <TransactionsList
            currentMonthTransactions={currentMonthTransactions}
          />
        ) : (
          <View style={styles.summaryContainer}>
            {/* Graph Card */}
            <View style={styles.graphCard}>
              <View style={styles.graphHeader}>
                <Text style={styles.graphTitle}>Spending Pattern</Text>
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
                  style={styles.dropdown}
                  textStyle={styles.dropdownText}
                  containerStyle={styles.dropdownContainer}
                  dropDownContainerStyle={styles.dropdownList}
                />
              </View>
              <BarGraph barData={barData} average={average} />
            </View>

            {/* Categories Cards */}
            <View style={styles.categoriesSection}>
              <Text style={styles.sectionTitle}>Top Categories</Text>
              <HorizontalSnapList data={featuredCardData} />
            </View>
          </View>
        )}
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      {reanderTransaction()}
      {selectedView == 1 ? <CustomFAB /> : null}

      {/* Search Modal */}
      <Modal
        visible={isSearchModalVisible}
        animationType="slide"
        onRequestClose={() => setIsSearchModalVisible(false)}
      >
        <SafeAreaView style={styles.searchModal}>
          <View style={styles.searchHeader}>
            <TouchableOpacity
              onPress={() => {
                setIsSearchModalVisible(false);
                setSearchText("");
                setSearchResults([]);
              }}
              style={styles.backButton}
            >
              <Icon
                name="arrow-left"
                type="material-community"
                size={24}
                color={COLORS.primary}
              />
            </TouchableOpacity>
            <View style={styles.searchInputContainer}>
              <TextInput
                style={styles.searchModalInput}
                placeholder="Search transactions..."
                value={searchText}
                onChangeText={handleSearchTextChange}
                autoFocus={true}
                placeholderTextColor={COLORS.darkgray}
              />
              {searchText.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setSearchText("");
                    setSearchResults([]);
                  }}
                  style={styles.clearButton}
                >
                  <Icon
                    name="clear"
                    type="material"
                    size={20}
                    color={COLORS.darkgray}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.searchContent}>
            {searchText.length > 0 ? (
              <>
                {searchSuggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    {searchSuggestions.map((suggestion, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.suggestionItem}
                        onPress={() => handleSuggestionPress(suggestion.text)}
                      >
                        <Icon
                          name="history"
                          type="material"
                          size={18}
                          color={COLORS.darkgray}
                        />
                        <Text style={styles.suggestionText}>{suggestion.text}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <View style={styles.searchResultsContainer}>
                  <Text style={styles.resultsHeader}>
                    {searchResults.length} results found
                  </Text>
                  <FlatList
                    data={searchResults}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                      <TransactionCard transaction={item} />
                    )}
                  />
                </View>
              </>
            ) : (
              <View style={styles.emptySearch}>
                <Icon
                  name="magnify"
                  type="material-community"
                  size={64}
                  color={COLORS.lightGray}
                />
                <Text style={styles.emptySearchText}>
                  Start typing to search transactions
                </Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const createStyles = (COLORS: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  headerSection: {
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding * 2.5,
    paddingBottom: SIZES.padding,
    flexDirection: "row",
    alignItems: "center",
    gap: SIZES.padding / 2,
  },
  balanceCard: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
    padding: SIZES.padding,
    borderRadius: 16,
  },
  balanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SIZES.base / 2,
  },
  balanceLabel: {
    ...FONTS.body4,
    color: COLORS.darkgray,
    marginLeft: SIZES.base,
  },
  balanceAmount: {
    ...FONTS.h1,
    color: COLORS.primary,
    fontWeight: "700",
  },
  searchButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.lightGray,
    justifyContent: "center",
    alignItems: "center",
  },
  monthSelectorContainer: {
    height: 70,
    marginBottom: SIZES.padding / 2,
  },
  monthItem: {
    width: SCREEN_WIDTH,
    justifyContent: "center",
    alignItems: "center",
  },
  monthText: {
    ...FONTS.h2,
    color: COLORS.primary,
    fontWeight: "600",
  },
  yearText: {
    ...FONTS.body4,
    color: COLORS.darkgray,
    marginTop: 2,
  },
  expenditureCard: {
    marginHorizontal: SIZES.padding,
    backgroundColor: COLORS.lightGray,
    padding: SIZES.padding,
    borderRadius: 16,
    marginBottom: SIZES.padding,
  },
  expenditureRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  expenditureIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SIZES.padding / 2,
  },
  expenditureInfo: {
    flex: 1,
  },
  expenditureLabel: {
    ...FONTS.body4,
    color: COLORS.darkgray,
    marginBottom: 2,
  },
  expenditureAmount: {
    ...FONTS.h2,
    color: COLORS.red2,
    fontWeight: "700",
  },
  transactionCount: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SIZES.padding / 2,
    paddingTop: SIZES.padding / 2,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray + "30",
  },
  transactionCountText: {
    ...FONTS.body4,
    color: COLORS.darkgray,
    marginLeft: SIZES.base / 2,
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: SIZES.padding,
    marginBottom: SIZES.padding / 2,
    gap: SIZES.padding / 2,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SIZES.padding / 2,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    gap: SIZES.base / 2,
  },
  activeTab: {
    backgroundColor: COLORS.lightGray,
  },
  tabText: {
    ...FONTS.body3,
    color: COLORS.darkgray,
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  summaryContainer: {
    flex: 1,
  },
  graphCard: {
    backgroundColor: COLORS.lightGray,
    marginHorizontal: SIZES.padding,
    padding: SIZES.padding,
    borderRadius: 16,
    marginBottom: SIZES.padding,
  },
  graphHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SIZES.padding,
  },
  graphTitle: {
    ...FONTS.h3,
    color: COLORS.primary,
    fontWeight: "600",
  },
  dropdown: {
    width: 105,
    borderWidth: 0,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    minHeight: 32,
  },
  dropdownText: {
    color: COLORS.darkgray,
    ...FONTS.body4,
  },
  dropdownContainer: {
    width: 100,
  },
  dropdownList: {
    backgroundColor: COLORS.white,
    borderWidth: 0,
    borderRadius: 8,
  },
  categoriesSection: {
    marginTop: SIZES.base / 2,
  },
  sectionTitle: {
    ...FONTS.h3,
    color: COLORS.primary,
    fontWeight: "600",
    marginLeft: SIZES.padding,
    marginBottom: SIZES.padding / 2,
  },
  searchModal: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  backButton: {
    marginRight: SIZES.padding / 2,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
    paddingHorizontal: SIZES.padding / 2,
  },
  searchModalInput: {
    flex: 1,
    paddingVertical: SIZES.padding / 2,
    paddingHorizontal: SIZES.padding / 4,
    color: COLORS.primary,
    ...FONTS.body3,
  },
  clearButton: {
    padding: 5,
  },
  searchContent: {
    flex: 1,
  },
  suggestionsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    paddingVertical: SIZES.base,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding / 2,
    gap: SIZES.padding / 2,
  },
  suggestionText: {
    ...FONTS.body3,
    color: COLORS.primary,
  },
  searchResultsContainer: {
    flex: 1,
    paddingTop: SIZES.padding,
  },
  resultsHeader: {
    ...FONTS.body3,
    color: COLORS.darkgray,
    paddingHorizontal: SIZES.padding,
    marginBottom: SIZES.padding / 2,
  },
  emptySearch: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptySearchText: {
    ...FONTS.body3,
    color: COLORS.darkgray,
    marginTop: SIZES.padding,
  },
});

export default TransactionScreen;

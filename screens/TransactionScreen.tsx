import { FONTS, SIZES } from "../constants";
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
  TouchableOpacity,
  FlatList,
  Dimensions,
  Modal,
  SafeAreaView,
  ScrollView,
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import { useState, useRef, useMemo } from "react";
import {
  formatAmountWithCommas,
  getTopCategoriesData,
} from "../services/Utils";
import { TextInput } from "react-native";
import { Icon } from "react-native-elements";

import { getBarData } from "../services/Utils";
import { useNavigation } from "@react-navigation/native";
import { useExpensifyStore } from "../store/store";
import { filterTransactions, getMonthRange } from "../services/Utils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const TransactionScreen: React.FC = () => {
  const { COLORS } = useTheme();
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
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const currentMonthIndex = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const { firstDate, lastDate } = getMonthRange(year, month);
  const transactionFilter = {
    startDate: firstDate.toISOString(),
    endDate: lastDate.toISOString(),
  };
  const currentMonthTransactions = filterTransactions(transactions, transactionFilter);

  // Check if we can go to next month (not future)
  const canGoNext = !(year === currentYear && month === currentMonthIndex);

  const goToPreviousMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const goToNextMonth = () => {
    if (!canGoNext) return;
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
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

  const remainingBalance = initialBalance - cumulativeExpenditure;
  const average = selectedOption === "weekly" ? initialBalance / 4 : initialBalance;
  const { barData } = getBarData(transactions, selectedOption as "weekly" | "monthly", month, year);
  const featuredCardData = getTopCategoriesData(currentMonthTransactions, lastMonthTransactions, categoriesById);

  const handleSearchTextChange = (text: string) => {
    setSearchText(text);
    if (text.trim() === "") {
      setSearchResults([]);
      setSearchSuggestions([]);
      return;
    }
    const lowercaseSearch = text.toLowerCase();
    const results = transactions
      .filter((transaction) => {
        const descriptionMatch = transaction.description?.toLowerCase().includes(lowercaseSearch);
        const amountMatch = transaction.amount.toString().includes(text);
        const categoryMatch = categoriesById[transaction.category_id]?.name?.toLowerCase().includes(lowercaseSearch);
        return descriptionMatch || amountMatch || categoryMatch;
      })
      .sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime())
      .slice(0, 50);
    setSearchResults(results);
    const uniqueDescriptions = new Set(
      transactions
        .map((t) => t.description?.trim())
        .filter((d) => d && d.toLowerCase().includes(lowercaseSearch)),
    );
    setSearchSuggestions(Array.from(uniqueDescriptions).slice(0, 5).map((desc) => ({ text: desc })));
  };

  const handleSuggestionPress = (suggestion: string) => {
    setSearchText(suggestion);
    handleSearchTextChange(suggestion);
  };

  return (
    <View style={styles.container}>
      {/* Header with month navigation */}
      <View style={styles.header}>
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}>
            <Icon name="chevron-left" type="material-community" size={28} color={COLORS.primary} />
          </TouchableOpacity>
          <View style={styles.monthDisplay}>
            <Text style={styles.headerTitle}>{months[month]}</Text>
            <Text style={styles.headerSubtitle}>{year}</Text>
          </View>
          <TouchableOpacity
            onPress={goToNextMonth}
            style={[styles.navButton, !canGoNext && styles.navButtonDisabled]}
            disabled={!canGoNext}
          >
            <Icon name="chevron-right" type="material-community" size={28} color={canGoNext ? COLORS.primary : COLORS.gray} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => setIsSearchModalVisible(true)}
        >
          <Icon name="magnify" type="material-community" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Financial Summary - Two compact cards */}
      <View style={styles.summaryCards}>
        <View style={styles.summaryCard}>
          <View style={[styles.cardIconCircle, { backgroundColor: COLORS.darkgreen + '20' }]}>
            <Icon name="wallet-outline" type="material-community" size={16} color={COLORS.darkgreen} />
          </View>
          <View style={styles.cardTextContainer}>
            <Text style={styles.cardLabel}>Balance</Text>
            <Text style={[styles.cardAmount, { color: remainingBalance >= 0 ? COLORS.darkgreen : COLORS.red2 }]}>
              ₹{formatAmountWithCommas(Math.abs(remainingBalance))}
            </Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={[styles.cardIconCircle, { backgroundColor: COLORS.red2 + '20' }]}>
            <Icon name="trending-down" type="material-community" size={16} color={COLORS.red2} />
          </View>
          <View style={styles.cardTextContainer}>
            <Text style={styles.cardLabel}>Spent</Text>
            <Text style={[styles.cardAmount, { color: COLORS.red2 }]}>
              ₹{formatAmountWithCommas(cumulativeExpenditure)}
            </Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedView === 1 && styles.activeTab]}
          onPress={() => setSelectedView(1)}
        >
          <Text style={[styles.tabText, selectedView === 1 && styles.activeTabText]}>List</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedView === 2 && styles.activeTab]}
          onPress={() => setSelectedView(2)}
        >
          <Text style={[styles.tabText, selectedView === 2 && styles.activeTabText]}>Summary</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {selectedView === 1 ? (
        <TransactionsList currentMonthTransactions={currentMonthTransactions} />
      ) : (
        <ScrollView style={styles.summaryScroll} showsVerticalScrollIndicator={false}>
          {/* Graph Section */}
          <View style={styles.graphSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Spending Pattern</Text>
              <View style={styles.dropdownWrapper}>
                <DropDownPicker
                  showTickIcon={false}
                  open={open}
                  value={selectedOption}
                  items={items}
                  setOpen={setOpen}
                  setValue={setSelectedOption}
                  setItems={setItems}
                  dropDownDirection="BOTTOM"
                  zIndex={5000}
                  zIndexInverse={1000}
                  style={styles.dropdown}
                  textStyle={styles.dropdownText}
                  containerStyle={styles.dropdownContainer}
                  dropDownContainerStyle={styles.dropdownList}
                  arrowIconStyle={{ tintColor: COLORS.darkgray }}
                  listMode="SCROLLVIEW"
                />
              </View>
            </View>
            <View style={styles.graphCard}>
              <BarGraph barData={barData} average={average} />
            </View>
          </View>

          {/* Categories Section */}
          <View style={styles.categoriesSection}>
            <Text style={styles.sectionTitleSimple}>Top Categories</Text>
            <HorizontalSnapList data={featuredCardData} />
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {selectedView === 1 && <CustomFAB />}

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
            >
              <Icon name="arrow-left" type="material-community" size={24} color={COLORS.primary} />
            </TouchableOpacity>
            <View style={styles.searchInputContainer}>
              <Icon name="magnify" type="material-community" size={20} color={COLORS.darkgray} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search transactions..."
                value={searchText}
                onChangeText={handleSearchTextChange}
                autoFocus={true}
                placeholderTextColor={COLORS.darkgray}
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchText(""); setSearchResults([]); }}>
                  <Icon name="close" type="material-community" size={20} color={COLORS.darkgray} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.searchContent}>
            {searchText.length > 0 ? (
              <>
                {searchSuggestions.length > 0 && (
                  <View style={styles.suggestions}>
                    {searchSuggestions.map((s, i) => (
                      <TouchableOpacity
                        key={i}
                        style={styles.suggestionItem}
                        onPress={() => handleSuggestionPress(s.text)}
                      >
                        <Icon name="history" type="material" size={18} color={COLORS.darkgray} />
                        <Text style={styles.suggestionText}>{s.text}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <Text style={styles.resultsCount}>{searchResults.length} results</Text>
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.searchResultsList}
                  renderItem={({ item }) => <TransactionCard item={item} />}
                />
              </>
            ) : (
              <View style={styles.emptySearch}>
                <Icon name="magnify" type="material-community" size={48} color={COLORS.gray} />
                <Text style={styles.emptySearchText}>Search by description, amount, or category</Text>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding * 2.5,
    paddingBottom: SIZES.base,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
  },
  navButton: {
    padding: 4,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  monthDisplay: {
    alignItems: "center",
    minWidth: 100,
  },
  headerTitle: {
    ...FONTS.h2,
    color: COLORS.primary,
  },
  headerSubtitle: {
    ...FONTS.body5,
    color: COLORS.darkgray,
  },
  searchButton: {
    padding: SIZES.base,
  },
  summaryCards: {
    flexDirection: "row",
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base / 2,
    gap: SIZES.base,
  },
  summaryCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.lightGray,
    borderRadius: 10,
    padding: SIZES.base + 2,
    gap: SIZES.base - 2,
  },
  cardIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTextContainer: {
    flex: 1,
  },
  cardLabel: {
    ...FONTS.body5,
    fontSize: 11,
    color: COLORS.darkgray,
  },
  cardAmount: {
    ...FONTS.body3,
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.primary,
  },
  tabContainer: {
    flexDirection: "row",
    marginHorizontal: SIZES.padding,
    marginVertical: SIZES.base,
    backgroundColor: COLORS.lightGray,
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: SIZES.base,
    alignItems: "center",
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: COLORS.white,
  },
  tabText: {
    ...FONTS.body3,
    color: COLORS.darkgray,
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  summaryScroll: {
    flex: 1,
  },
  graphSection: {
    zIndex: 5000,
    elevation: 5000,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SIZES.padding,
    marginBottom: SIZES.base,
    zIndex: 5000,
  },
  sectionTitle: {
    ...FONTS.body3,
    fontWeight: "600",
    color: COLORS.primary,
  },
  sectionTitleSimple: {
    ...FONTS.body3,
    fontWeight: "600",
    color: COLORS.primary,
    paddingHorizontal: SIZES.padding,
    marginTop: SIZES.padding,
    marginBottom: SIZES.base,
  },
  dropdownWrapper: {
    zIndex: 5000,
  },
  dropdown: {
    width: 110,
    minHeight: 32,
    borderWidth: 1,
    borderColor: COLORS.gray,
    borderRadius: 8,
    backgroundColor: COLORS.white,
  },
  dropdownText: {
    ...FONTS.body4,
    fontSize: 13,
    color: COLORS.darkgray,
  },
  dropdownContainer: {
    width: 110,
  },
  dropdownList: {
    borderWidth: 1,
    borderColor: COLORS.gray,
    backgroundColor: COLORS.white,
    zIndex: 6000,
    elevation: 6000,
  },
  graphCard: {
    marginHorizontal: SIZES.padding,
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
    padding: SIZES.padding/4,
    zIndex: 1,
  },
  categoriesSection: {
    zIndex: 1,
  },
  searchModal: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    gap: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.lightGray,
    borderRadius: 10,
    paddingHorizontal: SIZES.base,
    gap: SIZES.base,
  },
  searchInput: {
    flex: 1,
    paddingVertical: SIZES.base,
    ...FONTS.body3,
    color: COLORS.primary,
  },
  searchContent: {
    flex: 1,
  },
  suggestions: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
    gap: SIZES.base,
  },
  suggestionText: {
    ...FONTS.body3,
    color: COLORS.primary,
  },
  resultsCount: {
    ...FONTS.body4,
    color: COLORS.darkgray,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
  },
  searchResultsList: {
    paddingHorizontal: SIZES.padding,
  },
  emptySearch: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: SIZES.padding,
  },
  emptySearchText: {
    ...FONTS.body3,
    color: COLORS.darkgray,
  },
});

export default TransactionScreen;

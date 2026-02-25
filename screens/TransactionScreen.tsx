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
  const { barData } = getBarData(transactions, year, month, selectedOption, initialBalance);
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Transactions</Text>
        <TouchableOpacity
          style={styles.searchIcon}
          onPress={() => setIsSearchModalVisible(true)}
        >
          <Icon name="magnify" type="material-community" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Month Selector */}
      <FlatList
        ref={flatListRef}
        data={monthsData}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.monthSelector}
        renderItem={({ item }) => (
          <View style={styles.monthItem}>
            <Text style={styles.monthText}>{item.month} {item.year}</Text>
          </View>
        )}
      />

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Budget</Text>
          <Text style={styles.statValue}>₹{formatAmountWithCommas(initialBalance)}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Spent</Text>
          <Text style={[styles.statValue, { color: COLORS.red2 }]}>
            ₹{formatAmountWithCommas(cumulativeExpenditure)}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Transactions</Text>
          <Text style={styles.statValue}>{currentMonthTransactions.length}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, selectedView === 1 && styles.activeTab]}
          onPress={() => setSelectedView(1)}
        >
          <Text style={[styles.tabText, selectedView === 1 && styles.activeTabText]}>
            List
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedView === 2 && styles.activeTab]}
          onPress={() => setSelectedView(2)}
        >
          <Text style={[styles.tabText, selectedView === 2 && styles.activeTabText]}>
            Summary
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {selectedView === 1 ? (
        <TransactionsList currentMonthTransactions={currentMonthTransactions} />
      ) : (
        <ScrollView style={styles.summaryScroll} showsVerticalScrollIndicator={false}>
          {/* Graph Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Spending Pattern</Text>
              <DropDownPicker
                showTickIcon={false}
                open={open}
                value={selectedOption}
                items={items}
                setOpen={setOpen}
                setValue={setSelectedOption}
                setItems={setItems}
                dropDownDirection="BOTTOM"
                zIndex={1000}
                style={styles.dropdown}
                textStyle={styles.dropdownText}
                containerStyle={styles.dropdownContainer}
                dropDownContainerStyle={styles.dropdownList}
                arrowIconStyle={{ tintColor: COLORS.darkgray }}
              />
            </View>
            <View style={styles.graphContainer}>
              <BarGraph barData={barData} average={average} />
            </View>
          </View>

          {/* Categories Section */}
          <View style={[styles.section, { marginBottom: 100 }]}>
            <Text style={styles.sectionTitle}>Top Categories</Text>
            <HorizontalSnapList data={featuredCardData} />
          </View>
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
                  renderItem={({ item }) => <TransactionCard transaction={item} />}
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
    paddingBottom: SIZES.padding / 2,
  },
  headerTitle: {
    ...FONTS.h1,
    color: COLORS.primary,
  },
  searchIcon: {
    padding: SIZES.base,
  },
  monthSelector: {
    maxHeight: 40,
  },
  monthItem: {
    width: SCREEN_WIDTH,
    alignItems: "center",
    justifyContent: "center",
  },
  monthText: {
    ...FONTS.h3,
    color: COLORS.darkgray,
  },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: SIZES.padding,
    marginVertical: SIZES.padding,
    paddingVertical: SIZES.padding,
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    ...FONTS.body4,
    color: COLORS.darkgray,
    marginBottom: 4,
  },
  statValue: {
    ...FONTS.h3,
    color: COLORS.primary,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.gray,
    marginVertical: 4,
  },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: SIZES.padding,
    marginBottom: SIZES.padding,
    backgroundColor: COLORS.lightGray,
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: SIZES.base,
    alignItems: "center",
    borderRadius: 6,
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
  section: {
    marginHorizontal: SIZES.padding,
    marginBottom: SIZES.padding,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SIZES.padding,
  },
  sectionTitle: {
    ...FONTS.h3,
    color: COLORS.primary,
  },
  dropdown: {
    width: 100,
    minHeight: 32,
    borderWidth: 1,
    borderColor: COLORS.gray,
    borderRadius: 6,
    backgroundColor: COLORS.white,
  },
  dropdownText: {
    ...FONTS.body4,
    color: COLORS.darkgray,
  },
  dropdownContainer: {
    width: 100,
  },
  dropdownList: {
    borderWidth: 1,
    borderColor: COLORS.gray,
    backgroundColor: COLORS.white,
  },
  graphContainer: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
    padding: SIZES.padding,
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
    borderRadius: 8,
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

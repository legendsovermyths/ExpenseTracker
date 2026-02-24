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

const width = 345;
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
    const monthIndex = (currentMonthIndex - index + 12) % 12;
    const yearOffset = Math.floor((currentMonthIndex - index) / 12);
    return {
      month: months[monthIndex],
      year: currentYear + yearOffset,
      key: `${monthIndex}-${yearOffset}`,
    };
  });

  const handleScrollEnd = (event) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
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
  const topCategoriesData = getTopCategoriesData(
    currentMonthTransactions,
    lastMonthTransactions,
    categoriesById,
  );
  const featuredCardData = [...topCategoriesData];
  const totalExpenditure = currentMonthTransactions.reduce(
    (total, transaction) => {
      if (transaction.is_credit === false) {
        return total + Number(transaction.amount);
      }
      return total;
    },
    0,
  );

  const totalCashFlow = currentMonthTransactions.reduce(
    (total, transaction) => {
      if (transaction.is_credit === false) {
        return total + Number(transaction.amount);
      }
      return total;
    },
    0,
  );
  const totalBalance = initialBalance - totalCashFlow;
  const handleBalanceEdit = () => {
    navigation.navigate("BalanceEditScreen");
  };
  currentMonthTransactions.sort((a, b) => {
    const dateA = new Date(a.date_time);
    const dateB = new Date(b.date_time);
    return dateB - dateA;
  });
  const { barData, average } = getBarData(
    currentMonthTransactions,
    selectedOption,
    month,
    year,
  );

  const handleIconPress = (view) => {
    setSelectedView(view);
  };

  const generateSearchSuggestions = () => {
    const accountStore = useExpensifyStore.getState();
    const suggestions = new Set();
    
    // Get recent unique descriptions (last 50 transactions)
    const recentTransactions = transactions
      .sort((a, b) => new Date(b.date_time) - new Date(a.date_time))
      .slice(0, 50);
    
    recentTransactions.forEach(transaction => {
      if (transaction.description?.trim()) {
        suggestions.add(transaction.description.trim());
      }
      
      // Add account names
      const account = accountStore.getAccountById(transaction.account_id);
      if (account?.name) {
        suggestions.add(account.name);
      }
      
      // Add category names
      const category = transaction.subcategory_id 
        ? accountStore.getCategoryById(transaction.subcategory_id)
        : accountStore.getCategoryById(transaction.category_id);
      if (category?.name) {
        suggestions.add(category.name);
      }
    });
    
    return Array.from(suggestions).slice(0, 8); // Limit to 8 suggestions
  };

  const searchTransactions = (text) => {
    if (!text.trim()) {
      setSearchResults([]);
      setSearchSuggestions(generateSearchSuggestions());
      return;
    }

    const filtered = transactions.filter((transaction) => {
      const description = transaction.description?.toLowerCase() || "";
      const amount = transaction.amount?.toString() || "";
      const searchTerm = text.toLowerCase();
      
      // Get account and category names for searching
      const accountStore = useExpensifyStore.getState();
      const account = accountStore.getAccountById(transaction.account_id);
      const category = transaction.subcategory_id 
        ? accountStore.getCategoryById(transaction.subcategory_id)
        : accountStore.getCategoryById(transaction.category_id);
      
      const accountName = account?.name?.toLowerCase() || "";
      const categoryName = category?.name?.toLowerCase() || "";
      
      return description.includes(searchTerm) || 
             amount.includes(searchTerm) ||
             accountName.includes(searchTerm) ||
             categoryName.includes(searchTerm);
    });

    setSearchResults(filtered.slice(0, 20)); // Limit to 20 results
    
    // Filter suggestions based on search text
    const filteredSuggestions = generateSearchSuggestions()
      .filter(suggestion => 
        suggestion.toLowerCase().includes(text.toLowerCase()) && 
        suggestion.toLowerCase() !== text.toLowerCase()
      )
      .slice(0, 5);
    setSearchSuggestions(filteredSuggestions);
  };

  const handleSearchTextChange = (text) => {
    setSearchText(text);
    searchTransactions(text);
  };

  const openSearchModal = () => {
    setIsSearchModalVisible(true);
    setSearchSuggestions(generateSearchSuggestions());
  };

  const closeSearchModal = () => {
    setIsSearchModalVisible(false);
    setSearchText("");
    setSearchResults([]);
    setSearchSuggestions([]);
  };

  const handleSuggestionPress = (suggestion) => {
    setSearchText(suggestion);
    searchTransactions(suggestion);
  };

  const handleSearchResultPress = (transaction) => {
    // Close modal immediately and navigate
    setIsSearchModalVisible(false);
    navigation.navigate("TransactionEdit", {
      transaction: transaction,
      mode: "edit",
    });
    // Reset search state after navigation
    setSearchText("");
    setSearchResults([]);
    setSearchSuggestions([]);
  };

  const renderSearchResultCard = (transaction) => {
    const accountStore = useExpensifyStore.getState();
    const account = accountStore.getAccountById(transaction.account_id);
    const category = transaction.subcategory_id 
      ? accountStore.getCategoryById(transaction.subcategory_id)
      : accountStore.getCategoryById(transaction.category_id);

    return (
      <View style={styles.searchCard}>
        <View style={styles.searchCardHeader}>
          <Text style={styles.searchCardDate}>
            {getFormattedDate(transaction.date_time)}
          </Text>
          <Text style={[
            styles.searchCardAmount,
            { color: transaction.is_credit ? COLORS.darkgreen : COLORS.red2 }
          ]}>
            ₹{formatAmountWithCommas(transaction.amount)}
          </Text>
        </View>
        
        <View style={styles.searchCardContent}>
          <View style={styles.searchCardIconContainer}>
            <Icon
              name={category?.icon_name || "attach-money"}
              type={category?.icon_type || "material"}
              size={20}
              color={COLORS.lightBlue}
            />
          </View>
          
          <View style={styles.searchCardInfo}>
            <Text style={styles.searchCardTitle} numberOfLines={1}>
              {transaction.description}
            </Text>
            <Text style={styles.searchCardBank} numberOfLines={1}>
              {account?.name || "Unknown Account"}
            </Text>
          </View>
        </View>
      </View>
    );
  };
  function reanderTransaction() {
    return (
      <View
        style={{
          paddingHorizontal: SIZES.padding,
          paddingTop: (5 * SIZES.padding) / 2,
          backgroundColor: COLORS.white,
        }}
      >
        <View style={styles.monthHeaderWrapper}>
          <View style={styles.monthContainer}>
            <FlatList
              ref={flatListRef}
              horizontal
              inverted
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              data={monthsData}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <View
                  style={{
                    width: width,
                  }}
                >
                  <Text
                    style={{
                      marginLeft: SIZES.padding / 6,
                      color: COLORS.primary,
                      ...FONTS.h1,
                    }}
                  >
                    {item.month}
                  </Text>
                </View>
              )}
              onMomentumScrollEnd={handleScrollEnd}
              initialScrollIndex={0}
              getItemLayout={(_, index) => ({
                length: width,
                offset: width * index,
                index,
              })}
            />
          </View>
          <TouchableOpacity
            onPress={openSearchModal}
            style={styles.headerSearchButton}
          >
            <Icon
              name="search"
              type="material"
              size={28}
              color={COLORS.primary}
            />
          </TouchableOpacity>
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: (3 * SIZES.padding) / 4,
          }}
        >
          <View
            style={{
              flex: 1,
              marginRight: SIZES.padding / 5,
              marginBottom: 5,
            }}
          >
            <View
              style={{
                backgroundColor: COLORS.lightGray,
                borderRadius: 10,
                padding: SIZES.padding,
                elevation: 3,
              }}
            >
              <Text style={{ ...FONTS.h3, color: COLORS.darkgray }}>
                Expenditures
              </Text>
              <Text style={{ ...FONTS.h2, color: COLORS.red2 }}>
                ₹{formatAmountWithCommas(totalExpenditure, false)}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={{ flex: 1, marginLeft: SIZES.padding / 5 }}
            onPress={handleBalanceEdit}
          >
            <View>
              <View
                style={{
                  backgroundColor: COLORS.lightGray,
                  borderRadius: 10,
                  padding: SIZES.padding,
                  elevation: 3,
                }}
              >
                <Text style={{ ...FONTS.h3, color: COLORS.darkgray }}>
                  Balance
                </Text>
                <Text
                  style={{
                    ...FONTS.h2,
                    color: totalBalance > 0 ? COLORS.darkgreen : COLORS.red2,
                  }}
                >
                  ₹{formatAmountWithCommas(totalBalance, false)}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.container}>
          <Text style={styles.text}>
            {selectedView == 1 ? "Activity" : "Summary"}
          </Text>
          <View style={styles.iconsContainer}>
            <TouchableOpacity
              onPress={() => handleIconPress(2)}
              style={[
                styles.iconWrapper,
                selectedView === 2 && styles.selectedIcon,
              ]}
            >
              <Image
                source={icons.baricon}
                style={styles.icon}
                tintColor={selectedView == 2 ? COLORS.white : COLORS.darkgray}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleIconPress(1)}
              style={[
                styles.iconWrapper,
                selectedView === 1 && styles.selectedIcon,
              ]}
            >
              <Image
                source={icons.menu}
                style={styles.icon}
                tintColor={selectedView == 1 ? COLORS.white : COLORS.darkgray}
              />
            </TouchableOpacity>
          </View>
        </View>
        {selectedView == 1 ? (
          <TransactionsList
            currentMonthTransactions={currentMonthTransactions}
          />
        ) : (
          <View>
            <View
              style={{
                backgroundColor: COLORS.white,
                padding: 5,
                borderRadius: 10,
                marginTop: SIZES.padding / 4,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <View>
                  <Text
                    style={{
                      marginTop: 10,
                      marginLeft: 10,
                      color: COLORS.red2,
                      ...FONTS.h2,
                    }}
                  >
                    ₹{formatAmountWithCommas(average, false)}
                  </Text>
                  <Text
                    style={{
                      marginBottom: 10,
                      marginLeft: 10,
                      color: COLORS.darkgray,
                      ...FONTS.body4,
                    }}
                  >
                    {"Daily average" +
                      (selectedOption === "weekly" ? "(last 7 days)" : "")}
                  </Text>
                </View>
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
                  style={{
                    width: 105,
                    borderColor: COLORS.gray,
                    borderRadius: 5,
                    backgroundColor: COLORS.white,
                  }}
                  textStyle={{ color: COLORS.darkgray, ...FONTS.body4 }}
                  containerStyle={{ width: 100 }}
                  dropDownContainerStyle={{
                    backgroundColor: COLORS.white,
                    borderColor: COLORS.gray,
                  }}
                />
              </View>
              <BarGraph barData={barData} average={average} />
            </View>
            <View style={{ marginTop: 10 }}>
              <HorizontalSnapList data={featuredCardData} />
            </View>
          </View>
        )}
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      {/* Header section */}
      {reanderTransaction()}
      {selectedView == 1 ? <CustomFAB /> : null}
      
      {/* Full-screen Search Modal */}
      <Modal
        visible={isSearchModalVisible}
        animationType="slide"
        onRequestClose={closeSearchModal}
      >
        <SafeAreaView style={styles.searchModalContainer}>
          <StatusBar backgroundColor={COLORS.white} barStyle={isDark ? "light-content" : "dark-content"} />
          
          {/* Search Header */}
          <View style={styles.searchHeader}>
            <TouchableOpacity onPress={closeSearchModal} style={styles.backButton}>
              <Icon
                name="arrow-back"
                type="material"
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

          {/* Search Content */}
          <View style={styles.searchContent}>
            {searchText.length > 0 ? (
              <View style={styles.searchResultsContainer}>
                {searchSuggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    <Text style={styles.suggestionsTitle}>Suggestions:</Text>
                    <View style={styles.suggestionsWrapper}>
                      {searchSuggestions.map((suggestion, index) => (
                        <TouchableOpacity
                          key={index}
                          onPress={() => handleSuggestionPress(suggestion)}
                          style={styles.suggestionChip}
                        >
                          <Text style={styles.suggestionText}>{suggestion}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
                {searchResults.length > 0 ? (
                  <FlatList
                    data={searchResults}
                    keyExtractor={(item) => item.id.toString()}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: SIZES.padding * 2 }}
                    renderItem={({ item }) => (
                      <TouchableOpacity 
                        onPress={() => handleSearchResultPress(item)}
                        activeOpacity={0.7}
                        style={styles.searchResultItem}
                      >
                        {renderSearchResultCard(item)}
                      </TouchableOpacity>
                    )}
                  />
                ) : (
                  <View style={styles.noResultsContainer}>
                    <Text style={styles.noResultsText}>
                      No transactions found for "{searchText}"
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.searchResultsContainer}>
                {searchSuggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    <Text style={styles.suggestionsTitle}>Recent searches:</Text>
                    <View style={styles.suggestionsWrapper}>
                      {searchSuggestions.map((suggestion, index) => (
                        <TouchableOpacity
                          key={index}
                          onPress={() => handleSuggestionPress(suggestion)}
                          style={styles.suggestionChip}
                        >
                          <Text style={styles.suggestionText}>{suggestion}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  text: {
    ...FONTS.h2,
    color: COLORS.darkgray,
    marginLeft: SIZES.padding/4
  },
  iconsContainer: {
    flexDirection: "row",
  },
  iconWrapper: {
    marginLeft: 10,
    padding: 8,
    borderRadius: 50,
  },
  selectedIcon: {
    backgroundColor: COLORS.secondary,
  },
  icon: {
    width: 17,
    height: 17,
  },
  // Header styles
  monthHeaderWrapper: {
    position: "relative",
  },
  monthContainer: {
    width: width,
  },
  headerSearchButton: {
    position: "absolute",
    right: 0,
    top: 0,
    padding: SIZES.padding / 4,
    backgroundColor: COLORS.white,
    zIndex: 1,
  },
  // Search Modal Styles
  searchModalContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding / 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
    elevation: 2,
  },
  backButton: {
    marginRight: SIZES.padding / 2,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.lightGray,
    borderRadius: 25,
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
    paddingHorizontal: SIZES.padding,
  },
  searchResultsContainer: {
    flex: 1,
    marginTop: SIZES.padding / 2,
  },
  searchResultItem: {
    marginVertical: SIZES.padding / 8,
  },
  // Custom Search Card Styles
  searchCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: SIZES.padding / 2,
    marginHorizontal: 2,
    elevation: 1,
    shadowColor: COLORS.darkgray,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  searchCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SIZES.padding / 4,
  },
  searchCardDate: {
    color: COLORS.darkgray,
    ...FONTS.body5,
    opacity: 0.7,
  },
  searchCardAmount: {
    ...FONTS.body3,
    fontWeight: "600",
  },
  searchCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchCardIconContainer: {
    backgroundColor: COLORS.lightGray,
    height: 35,
    width: 35,
    borderRadius: 17.5,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SIZES.padding / 3,
  },
  searchCardInfo: {
    flex: 1,
  },
  searchCardTitle: {
    color: COLORS.primary,
    ...FONTS.body3,
    fontWeight: "500",
    marginBottom: 1,
  },
  searchCardBank: {
    color: COLORS.darkgray,
    ...FONTS.body5,
    opacity: 0.6,
  },
  noResultsContainer: {
    alignItems: "center",
    paddingVertical: SIZES.padding * 3,
  },
  noResultsText: {
    color: COLORS.darkgray,
    ...FONTS.body3,
    textAlign: "center",
  },
  suggestionsContainer: {
    marginBottom: SIZES.padding,
  },
  suggestionsTitle: {
    color: COLORS.darkgray,
    ...FONTS.body3,
    marginBottom: SIZES.padding / 2,
    fontWeight: "600",
  },
  suggestionsWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  suggestionChip: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: SIZES.padding / 2,
    paddingVertical: SIZES.padding / 3,
    borderRadius: 20,
    marginRight: SIZES.padding / 3,
    marginBottom: SIZES.padding / 3,
    elevation: 2,
  },
  suggestionText: {
    color: COLORS.white,
    ...FONTS.body4,
    fontWeight: "500",
  },
});

export default TransactionScreen;

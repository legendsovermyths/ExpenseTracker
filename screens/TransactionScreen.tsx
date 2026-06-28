import { FONTS, SIZES } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";
import CustomFAB from "../components/CustomFAB";
import TransactionsList from "../components/TransactionList";
import TransactionCard from "../components/TransactionCard";
import HorizontalSnapList from "../components/HorizontalSnapList";
import BarGraph from "../components/BarGraph";
import { Surface, GlyphPlate, Chip } from "../components/primitives";
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
  Alert,
  LayoutAnimation,
} from "react-native";
import { Transaction } from "../types/entity/Transaction";
import { deleteTransaction } from "../services/TransactionService";
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

// A soft, consistent easing for selection-mode transitions.
const animateSelection = () =>
  LayoutAnimation.configureNext(
    LayoutAnimation.create(
      240,
      LayoutAnimation.Types.easeInEaseOut,
      LayoutAnimation.Properties.opacity,
    ),
  );

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
  const [searching, setSearching] = useState(false);
  const [searchText, setSearchText] = useState("");
  const navigation = useNavigation<any>();

  // Multi-select
  const deleteTransactionFromUI = useExpensifyStore((state) => state.deleteTransaction);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const enterSelection = (transaction: Transaction) => {
    animateSelection();
    setSelectionMode(true);
    setSelectedIds(new Set([transaction.id]));
  };

  const exitSelection = () => {
    animateSelection();
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (transaction: Transaction) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(transaction.id)) next.delete(transaction.id);
      else next.add(transaction.id);
      if (next.size === 0) {
        animateSelection();
        setSelectionMode(false);
      }
      return next;
    });
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    Alert.alert(
      "Delete Transactions",
      `Delete ${ids.length} transaction${ids.length === 1 ? "" : "s"}? This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            for (const id of ids) {
              const txn = transactionById[id];
              if (!txn) continue;
              try {
                await deleteTransaction(txn);
                deleteTransactionFromUI(id);
              } catch { /* skip failed */ }
            }
            exitSelection();
          },
        },
      ],
    );
  };

  const handleBulkEdit = () => {
    const items = Array.from(selectedIds)
      .map((id) => transactionById[id])
      .filter(Boolean)
      .map((t) => ({
        id: t.id,
        description: t.description,
        amount: t.amount,
        is_credit: t.is_credit,
        account_id: t.account_id,
        category_id: t.category_id,
        subcategory_id: t.subcategory_id ?? undefined,
        date: t.date_time,
      }));
    if (items.length === 0) return;
    exitSelection();
    navigation.navigate("TransactionEdit", {
      prefill: items[0],
      bulkQueue: items,
      bulkIndex: 0,
      bulkMode: "edit",
    });
  };

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
  const { barData, average } = getBarData(transactions, selectedOption as "weekly" | "monthly", month, year);
  const featuredCardData = getTopCategoriesData(currentMonthTransactions, lastMonthTransactions, categoriesById);

  // Derive results from the live store so edits made on a result (and the
  // back-navigation that follows) reflect immediately instead of showing a
  // stale snapshot.
  const searchResults = useMemo(() => {
    if (searchText.trim() === "") return [];
    const lowercaseSearch = searchText.toLowerCase();
    return transactions
      .filter((transaction) => {
        const descriptionMatch = transaction.description?.toLowerCase().includes(lowercaseSearch);
        const amountMatch = transaction.amount.toString().includes(searchText);
        const categoryMatch = categoriesById[transaction.category_id]?.name?.toLowerCase().includes(lowercaseSearch);
        return descriptionMatch || amountMatch || categoryMatch;
      })
      .sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime())
      .slice(0, 50);
  }, [searchText, transactionById, categoriesById]);

  const searchSuggestions = useMemo(() => {
    if (searchText.trim() === "") return [];
    const lowercaseSearch = searchText.toLowerCase();
    const uniqueDescriptions = new Set(
      transactions
        .map((t) => t.description?.trim())
        .filter((d) => d && d.toLowerCase().includes(lowercaseSearch)),
    );
    return Array.from(uniqueDescriptions).slice(0, 5).map((desc) => ({ text: desc }));
  }, [searchText, transactionById]);

  const handleSearchTextChange = (text: string) => setSearchText(text);

  const handleSuggestionPress = (suggestion: string) => setSearchText(suggestion);

  // Running total of the current selection — shown in the selection bar.
  const selectedTotal = Array.from(selectedIds).reduce(
    (sum, id) => sum + (transactionById[id]?.amount || 0),
    0,
  );

  return (
    <View style={styles.container}>
      {/* Selection action bar */}
      {selectionMode ? (
        <View style={styles.selectionHeader}>
          <TouchableOpacity onPress={exitSelection} style={styles.navButton}>
            <Icon name="close" type="material-community" size={26} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.selectionTitle}>
            {selectedIds.size} · ₹{formatAmountWithCommas(selectedTotal, false)}
          </Text>
          <View style={styles.selectionActions}>
            <TouchableOpacity
              onPress={handleBulkEdit}
              disabled={selectedIds.size === 0}
              style={styles.selectionActionBtn}
            >
              <Icon name="pencil" type="material-community" size={22} color={COLORS.accent} />
              <Text style={[styles.selectionActionText, { color: COLORS.accent }]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleBulkDelete}
              disabled={selectedIds.size === 0}
              style={styles.selectionActionBtn}
            >
              <Icon name="trash-can-outline" type="material-community" size={22} color={COLORS.deltaUp} />
              <Text style={[styles.selectionActionText, { color: COLORS.deltaUp }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
      /* Header with month navigation */
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
          onPress={() => setSearching(true)}
        >
          <Icon name="magnify" type="material-community" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      )}

      {/* Financial Summary - Two compact cards */}
      <View style={styles.summaryCards}>
        <Surface tier={1} style={styles.summaryCard} padding={SIZES.base + 4}>
          <GlyphPlate
            name="wallet-outline"
            type="material-community"
            color={COLORS.deltaDown}
            size={28}
            radius={8}
          />
          <View style={styles.cardTextContainer}>
            <Text style={styles.cardLabel}>BALANCE</Text>
            <Text style={[styles.cardAmount, { color: remainingBalance >= 0 ? COLORS.deltaDown : COLORS.deltaUp }]}>
              {remainingBalance < 0 ? "-" : ""}₹{formatAmountWithCommas(Math.abs(remainingBalance), false)}
            </Text>
          </View>
        </Surface>

        <Surface tier={1} style={styles.summaryCard} padding={SIZES.base + 4}>
          <GlyphPlate
            name="trending-down"
            type="material-community"
            color={COLORS.accent}
            size={28}
            radius={8}
          />
          <View style={styles.cardTextContainer}>
            <Text style={styles.cardLabel}>SPENT</Text>
            <Text style={[styles.cardAmount, { color: COLORS.ink }]}>
              ₹{formatAmountWithCommas(cumulativeExpenditure, false)}
            </Text>
          </View>
        </Surface>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <Chip
          options={[
            { key: "list", label: "List" },
            { key: "summary", label: "Summary" },
          ]}
          value={selectedView === 1 ? "list" : "summary"}
          onChange={(k) => setSelectedView(k === "list" ? 1 : 2)}
        />
      </View>

      {/* Content */}
      {selectedView === 1 ? (
        <TransactionsList
          currentMonthTransactions={currentMonthTransactions}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onLongPressItem={enterSelection}
        />
      ) : (
        <ScrollView style={styles.summaryScroll} showsVerticalScrollIndicator={false}>
          {/* Graph Section */}
          <View style={styles.graphSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>SPENDING PATTERN</Text>
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
                  arrowIconStyle={{ tintColor: COLORS.inkMuted }}
                  listMode="SCROLLVIEW"
                />
              </View>
            </View>
            <View style={styles.graphCardWrap}>
              <Surface tier={1} padding={SIZES.padding / 4} style={styles.graphSurface}>
                <BarGraph barData={barData} average={average} />
              </Surface>
            </View>
          </View>

          {/* Categories Section */}
          <View style={styles.categoriesSection}>
            <Text style={[styles.sectionLabel, styles.sectionLabelIndented]}>
              TOP CATEGORIES
            </Text>
            <HorizontalSnapList data={featuredCardData} />
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {selectedView === 1 && !selectionMode && <CustomFAB />}

      {/* Search — inline overlay, no modal slide */}
      {searching && (
        <View style={styles.searchOverlay}>
          <View style={styles.searchHeader}>
            <TouchableOpacity
              onPress={() => {
                setSearching(false);
                setSearchText("");
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
                <TouchableOpacity onPress={() => setSearchText("")}>
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
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.searchResultsList}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        setSearching(false);
                        navigation.navigate("TransactionEdit", { transaction: item, mode: "edit" });
                      }}
                    >
                      <TransactionCard item={item} />
                    </TouchableOpacity>
                  )}
                />
              </>
            ) : (
              <View style={styles.emptySearch}>
                <Icon name="magnify" type="material-community" size={48} color={COLORS.gray} />
                <Text style={styles.emptySearchText}>Search by description, amount, or category</Text>
              </View>
            )}
          </View>
        </View>
      )}
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
  selectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding * 2.5,
    paddingBottom: SIZES.base,
    gap: SIZES.base + 4,
  },
  selectionTitle: {
    ...FONTS.h3,
    color: COLORS.ink,
    flex: 1,
  },
  selectionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SIZES.padding,
  },
  selectionActionBtn: {
    alignItems: "center",
    gap: 2,
  },
  selectionActionText: {
    ...FONTS.caption,
    letterSpacing: 0.3,
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
    ...FONTS.caption,
    color: COLORS.inkMuted,
    letterSpacing: 0.4,
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
    gap: SIZES.base,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardLabel: {
    ...FONTS.caption,
    color: COLORS.inkMuted,
    letterSpacing: 1.2,
  },
  cardAmount: {
    fontSize: 17,
    fontFamily: "Roboto-Bold",
    fontVariant: ["tabular-nums"],
    color: COLORS.ink,
    letterSpacing: -0.2,
    marginTop: 1,
  },
  tabContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginHorizontal: SIZES.padding,
    marginVertical: SIZES.base,
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
    marginTop: SIZES.padding * 0.75,
    marginBottom: 10,
    zIndex: 5000,
  },
  sectionLabel: {
    ...FONTS.sectionLabel,
    color: COLORS.inkMuted,
    textTransform: "uppercase",
  },
  sectionLabelIndented: {
    paddingHorizontal: SIZES.padding,
    marginTop: SIZES.padding,
    marginBottom: 10,
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
  graphCardWrap: {
    marginHorizontal: SIZES.padding,
    zIndex: 1,
  },
  graphSurface: {
    overflow: "hidden",
  },
  categoriesSection: {
    zIndex: 1,
  },
  searchModal: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  searchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.white,
    zIndex: 20,
    elevation: 20,
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding * 2.5,
    paddingBottom: SIZES.base + 4,
    gap: SIZES.base + 4,
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

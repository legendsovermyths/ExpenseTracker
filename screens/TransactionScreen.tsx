import React, { useEffect, useMemo, useState } from "react";
import { LayoutAnimation, ScrollView, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SPACE } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";
import CustomFAB from "../components/CustomFAB";
import TransactionsList from "../components/TransactionList";
import TransactionCard from "../components/TransactionCard";
import BarGraph from "../components/BarGraph";
import {
  Amount,
  EmptyState,
  GlyphPlate,
  HeaderIconButton,
  Icon,
  LargeTitle,
  ListRow,
  Pressable,
  SearchField,
  SectionLabel,
  SegmentedControl,
  Stat,
  StatStrip,
  Text,
  confirm,
  toast,
} from "../components/ui";
import { Transaction } from "../types/entity/Transaction";
import { deleteTransaction } from "../services/TransactionService";
import { formatAmountWithCommas, getTopCategoriesData, getBarData, filterTransactions, getMonthRange } from "../services/Utils";
import { useExpensifyStore } from "../store/store";
import { ensureTransactionsLoadedFrom } from "../services/TransactionWindow";
import { invokeBackend } from "../services/api";
import { Action } from "../types/actions/actions";

// A soft, consistent easing for selection-mode transitions.
const animateSelection = () =>
  LayoutAnimation.configureNext(
    LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
  );

const TransactionScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();
  const transactionById = useExpensifyStore((state) => state.transactions);
  const initialBalance = parseInt(
    useExpensifyStore((state) => state.getAppconstantByKey("balance")).value,
  );
  const { year, month } = useExpensifyStore((state) => state.selectedMonth);
  const setSelectedMonth = useExpensifyStore((state) => state.setSelectedMonth);
  const [selectedOption, setSelectedOption] = useState<"weekly" | "monthly">("weekly");
  const categoriesById = useExpensifyStore((state) => state.categories);
  const mergeTransactions = useExpensifyStore((state) => state.mergeTransactions);
  const transactions = Object.values(transactionById);
  const [view, setView] = useState<"list" | "summary">("list");
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

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const ok = await confirm({
      title: `Delete ${ids.length} transaction${ids.length === 1 ? "" : "s"}?`,
      message: "This can't be undone.",
    });
    if (!ok) return;
    let deleted = 0;
    for (const id of ids) {
      const txn = transactionById[id];
      if (!txn) continue;
      try {
        await deleteTransaction(txn);
        deleteTransactionFromUI(id);
        deleted++;
      } catch {
        /* skip failed */
      }
    }
    exitSelection();
    toast(
      deleted === ids.length ? `Deleted ${deleted} transaction${deleted === 1 ? "" : "s"}` : `Deleted ${deleted} of ${ids.length}`,
      deleted === ids.length ? "success" : "error",
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
    if (month === 0) setSelectedMonth(year - 1, 11);
    else setSelectedMonth(year, month - 1);
  };

  const goToNextMonth = () => {
    if (!canGoNext) return;
    if (month === 11) setSelectedMonth(year + 1, 0);
    else setSelectedMonth(year, month + 1);
  };

  const prevMonthYear = month === 0 ? year - 1 : year;
  const prevMonthIndex = month === 0 ? 11 : month - 1;
  const { firstDate: prevFirstDate, lastDate: prevLastDate } = getMonthRange(prevMonthYear, prevMonthIndex);
  const lastMonthTransactions = filterTransactions(transactions, {
    startDate: prevFirstDate.toISOString(),
    endDate: prevLastDate.toISOString(),
  });

  // Browsing to a month older than the 6-month hot window — pull in older
  // batches (incl. the prior month used for comparisons) so the list/graph
  // for that month isn't silently empty.
  const prevFirstISO = prevFirstDate.toISOString();
  useEffect(() => {
    ensureTransactionsLoadedFrom(new Date(prevFirstISO));
  }, [prevFirstISO]);

  const cumulativeExpenditure = currentMonthTransactions.reduce(
    (acc, transaction) =>
      transaction.is_credit ? acc : acc + transaction.amount,
    0,
  );

  const remainingBalance = initialBalance - cumulativeExpenditure;
  const { barData, average } = getBarData(transactions, selectedOption, month, year, COLORS.accentWarm);
  const featuredCardData = getTopCategoriesData(currentMonthTransactions, lastMonthTransactions);

  // Searched directly against the database (not the in-memory 6-month
  // window) so it finds matches regardless of age — description, amount,
  // and category name, matching the previous client-side filter's fields.
  const [searchResults, setSearchResults] = useState<Transaction[]>([]);
  useEffect(() => {
    if (searchText.trim() === "") {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    const timeout = setTimeout(async () => {
      const response = await invokeBackend(Action.GetTransactions, {
        search_text: searchText.trim(),
        limit: 50,
      });
      const results = response.additions?.transactions ?? [];
      if (!cancelled) {
        setSearchResults(results);
        // A search result can be older than the 6-month hot window and thus
        // absent from the store — merge it in so tapping to edit/delete it
        // correctly updates the account balance instead of silently no-op'ing
        // against a transaction the store doesn't know about yet.
        mergeTransactions(results);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [searchText, mergeTransactions]);

  const searchSuggestions = useMemo(() => {
    const uniqueDescriptions = new Set(
      searchResults.map((t) => t.description?.trim()).filter(Boolean),
    );
    return Array.from(uniqueDescriptions).slice(0, 5).map((desc) => ({ text: desc }));
  }, [searchResults]);

  // Running total of the current selection — shown in the selection bar.
  const selectedTotal = Array.from(selectedIds).reduce(
    (sum, id) => sum + (transactionById[id]?.amount || 0),
    0,
  );

  const closeSearch = () => {
    setSearching(false);
    setSearchText("");
  };

  const header = selectionMode ? (
    <LargeTitle
      title={`${selectedIds.size} selected`}
      subtitle={`₹${formatAmountWithCommas(selectedTotal, false)}`}
      right={
        <>
          <HeaderIconButton icon="pencil-outline" label="Edit selected" onPress={handleBulkEdit} disabled={selectedIds.size === 0} />
          <HeaderIconButton icon="trash-can-outline" label="Delete selected" tone="destructive" onPress={handleBulkDelete} disabled={selectedIds.size === 0} />
          <HeaderIconButton icon="close" label="Cancel selection" tone="ink" onPress={exitSelection} />
        </>
      }
    />
  ) : (
    <LargeTitle
      title={months[month]}
      subtitle={String(year)}
      right={
        <>
          <HeaderIconButton icon="chevron-left" label="Previous month" tone="ink" onPress={goToPreviousMonth} />
          <HeaderIconButton icon="chevron-right" label="Next month" tone="ink" onPress={goToNextMonth} disabled={!canGoNext} />
          <HeaderIconButton icon="magnify" label="Search transactions" tone="ink" onPress={() => setSearching(true)} />
        </>
      }
    />
  );

  return (
    <View style={styles.container}>
      {header}

      <View style={styles.gutter}>
        <StatStrip style={styles.strip}>
          <Stat
            value={
              <Amount
                cents={Math.round(remainingBalance * 100)}
                decimals="never"
                sign="auto"
                variant="title"
                tone={remainingBalance >= 0 ? "down" : "up"}
              />
            }
            label="left in budget"
          />
          <Stat value={<Amount cents={Math.round(cumulativeExpenditure * 100)} decimals="never" variant="title" />} label="spent" />
        </StatStrip>

        <SegmentedControl
          value={view}
          onChange={setView}
          options={[
            { key: "list", label: "List" },
            { key: "summary", label: "Summary" },
          ]}
          style={styles.segment}
        />
      </View>

      {view === "list" ? (
        <TransactionsList
          currentMonthTransactions={currentMonthTransactions}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onLongPressItem={enterSelection}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.summaryContent} showsVerticalScrollIndicator={false}>
          <SectionLabel
            title="Spending pattern"
            right={
              <SegmentedControl
                size="sm"
                value={selectedOption}
                onChange={setSelectedOption}
                options={[
                  { key: "weekly", label: "Weekly" },
                  { key: "monthly", label: "Monthly" },
                ]}
                style={styles.periodSegment}
              />
            }
          />
          <BarGraph barData={barData} average={average} />

          {featuredCardData.length > 0 && (
            <>
              <SectionLabel title="Top categories" />
              {featuredCardData.map((c) => {
                const category = categoriesById[c.key];
                if (!category) return null;
                const hasChange = c.change !== "N/A";
                const down = hasChange && c.change.startsWith("-");
                const pct = hasChange ? `${Math.round(Math.abs(parseFloat(c.change)))}%` : null;
                return (
                  <ListRow
                    key={c.key}
                    padded={false}
                    leading={
                      <GlyphPlate
                        name={category.icon_name}
                        type={category.icon_type}
                        color={COLORS.ordinal[Math.abs(c.key) % COLORS.ordinal.length]}
                        size={36}
                        radius={10}
                      />
                    }
                    title={category.name}
                    subtitle={[
                      `${c.transactions} ${c.transactions === 1 ? "transaction" : "transactions"}`,
                      pct ? `${down ? "↓" : "↑"} ${pct} vs last month` : null,
                    ]
                      .filter(Boolean)
                      .join("  ·  ")}
                    trailing={<Amount cents={Math.round(c.spent * 100)} decimals="never" />}
                    onPress={() => {
                      const range = getMonthRange(c.year, c.month);
                      navigation.navigate("SubcategoryStat", {
                        category,
                        percentage: 0,
                        startDate: range.firstDate,
                        endDate: range.lastDate,
                      });
                    }}
                  />
                );
              })}
            </>
          )}
        </ScrollView>
      )}

      {view === "list" && !selectionMode && <CustomFAB />}

      {searching && (
        <View style={[styles.searchOverlay, { paddingTop: insets.top + SPACE.sm }]}>
          <View style={styles.searchBar}>
            <SearchField
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Description, amount or category"
              autoFocus
              style={styles.flex}
            />
            <Pressable onPress={closeSearch} accessibilityLabel="Close search">
              <Text variant="headline" tone="accent">Cancel</Text>
            </Pressable>
          </View>

          {searchText.length > 0 ? (
            <FlashList
              data={searchResults}
              keyExtractor={(t) => String(t.id)}
              estimatedItemSize={60}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={styles.searchList}
              ListHeaderComponent={
                <>
                  {searchSuggestions.map((sug) => (
                    <ListRow
                      key={sug.text}
                      padded={false}
                      dense
                      leading={<Icon name="history" size="md" color={COLORS.inkSubtle} />}
                      title={sug.text}
                      onPress={() => setSearchText(sug.text)}
                    />
                  ))}
                  <Text variant="label" tone="muted" style={styles.resultsCount}>
                    {searchResults.length} {searchResults.length === 1 ? "result" : "results"}
                  </Text>
                </>
              }
              renderItem={({ item }) => (
                <Pressable
                  scale={false}
                  onPress={() => {
                    closeSearch();
                    navigation.navigate("TransactionEdit", { transaction: item, mode: "edit" });
                  }}
                >
                  <TransactionCard item={item} />
                </Pressable>
              )}
            />
          ) : (
            <EmptyState icon="magnify" title="Search everything" message="Find any transaction by description, amount or category — even years back." />
          )}
        </View>
      )}
    </View>
  );
};

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.paper },
    flex: { flex: 1 },
    gutter: { paddingHorizontal: SPACE.gutter },
    strip: { paddingTop: SPACE.sm },
    segment: { marginTop: SPACE.md, marginBottom: SPACE.xs },
    periodSegment: { width: 150 },
    summaryContent: { paddingHorizontal: SPACE.gutter, paddingBottom: 120 },
    searchOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.paper, zIndex: 20 },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACE.md,
      paddingHorizontal: SPACE.gutter,
      paddingBottom: SPACE.sm,
    },
    searchList: { paddingHorizontal: SPACE.gutter, paddingBottom: SPACE.xxxl },
    resultsCount: { marginTop: SPACE.lg, marginBottom: SPACE.xs },
  });

export default TransactionScreen;

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { LayoutAnimation, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useNavigation } from "@react-navigation/native";
import { SPACE } from "../constants";
import { getFormattedDate, getLocalDateFromISO } from "../services/Utils";
import { Transaction } from "../types/entity/Transaction";
import { useTheme } from "../contexts/ThemeContext";
import TransactionCard from "./TransactionCard";
import { Amount, EmptyState, FeedbackRow, Pressable, Text } from "./ui";

interface TransactionListProps {
  currentMonthTransactions: Transaction[];
  selectionMode?: boolean;
  selectedIds?: Set<number>;
  onToggleSelect?: (transaction: Transaction) => void;
  onLongPressItem?: (transaction: Transaction) => void;
  /** Rendered above the list, scrolls with it. */
  header?: React.ReactElement | null;
  /** Extra bottom padding (tab bar / FAB clearance). */
  bottomInset?: number;
}

type Row =
  | { kind: "date"; key: string; title: string; total: number }
  | { kind: "txn"; key: string; item: Transaction; last: boolean };

/** Date-grouped transaction list on FlashList with sticky day headers. */
const TransactionsList: React.FC<TransactionListProps> = ({
  currentMonthTransactions,
  selectionMode = false,
  selectedIds,
  onToggleSelect,
  onLongPressItem,
  header,
  bottomInset = 120,
}) => {
  const { COLORS } = useTheme();
  const navigation = useNavigation<any>();
  const listRef = useRef<FlashList<Row>>(null);
  const prevIds = useRef<Set<number> | null>(null);

  const { rows, stickyIndices, spent } = useMemo(() => {
    const sorted = [...currentMonthTransactions].sort(
      (a, b) =>
        new Date(b.date_time).getTime() - new Date(a.date_time).getTime(),
    );
    const groups = new Map<string, Transaction[]>();
    sorted.forEach((t) => {
      const d = getLocalDateFromISO(t.date_time);
      if (!d) return;
      if (!groups.has(d)) groups.set(d, []);
      groups.get(d)!.push(t);
    });
    const out: Row[] = [];
    const sticky: number[] = [];
    groups.forEach((items, title) => {
      sticky.push(out.length);
      out.push({
        kind: "date",
        key: `d-${title}`,
        title,
        total: items
          .filter((t) => !t.is_credit)
          .reduce((s, t) => s + t.amount, 0),
      });
      items.forEach((item, i) =>
        out.push({
          kind: "txn",
          key: `t-${item.id}`,
          item,
          last: i === items.length - 1,
        }),
      );
    });
    return {
      rows: out,
      stickyIndices: sticky,
      spent: sorted
        .filter((t) => !t.is_credit)
        .reduce((a, t) => a + t.amount, 0),
    };
  }, [currentMonthTransactions]);

  // When rows are added or removed, let neighbours glide instead of jumping.
  // (Not on first render or month switches, where the whole list changes.)
  useEffect(() => {
    const ids = new Set(currentMonthTransactions.map((t) => t.id));
    const prev = prevIds.current;
    prevIds.current = ids;
    if (!prev) return;
    let added = 0;
    let removed = 0;
    ids.forEach((id) => !prev.has(id) && added++);
    prev.forEach((id) => !ids.has(id) && removed++);
    if (
      added + removed === 0 ||
      added + removed > 12 ||
      (added && removed && added === ids.size)
    )
      return;
    listRef.current?.prepareForLayoutAnimationRender();
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        220,
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity,
      ),
    );
  }, [currentMonthTransactions]);

  const onPress = useCallback(
    (item: Transaction) => {
      if (selectionMode) onToggleSelect?.(item);
      else
        navigation.navigate("TransactionEdit", {
          transaction: item,
          mode: "edit",
        });
    },
    [selectionMode, onToggleSelect, navigation],
  );

  const renderItem = ({ item: row }: { item: Row }) => {
    if (row.kind === "date") {
      return (
        <Pressable
          scale={false}
          disabled={selectionMode}
          accessibilityLabel={`Add a transaction on ${getFormattedDate(row.title)}`}
          onPress={() =>
            navigation.navigate("TransactionEdit", {
              transaction: { date_time: new Date(row.title).toISOString() },
              mode: "add",
            })
          }
          style={[
            styles.dateRow,
            styles.gutter,
            { backgroundColor: COLORS.paper },
          ]}
        >
          <Text variant="label" tone="muted">
            {getFormattedDate(row.title)}
          </Text>
          {row.total > 0 && (
            <Amount
              cents={Math.round(row.total * 100)}
              decimals="never"
              variant="caption"
              tone="subtle"
            />
          )}
        </Pressable>
      );
    }
    const selected = !!selectedIds?.has(row.item.id);
    return (
      <Pressable
        scale={false}
        onPress={() => onPress(row.item)}
        onLongPress={() => onLongPressItem?.(row.item)}
        delayLongPress={250}
        style={[styles.gutter, selectionMode && !selected && styles.dimmed]}
      >
        <FeedbackRow kind="transaction" id={row.item.id}>
          <View
            style={
              !row.last && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: COLORS.hairline,
              }
            }
          >
            <TransactionCard
              item={row.item}
              selected={selectionMode && selected}
            />
          </View>
        </FeedbackRow>
      </Pressable>
    );
  };

  const count = currentMonthTransactions.length;

  return (
    <FlashList
      ref={listRef}
      data={rows}
      renderItem={renderItem}
      keyExtractor={(r) => r.key}
      getItemType={(r) => r.kind}
      stickyHeaderIndices={stickyIndices.map((i) => i + (header ? 1 : 0))}
      estimatedItemSize={60}
      extraData={{ selectionMode, selectedIds, COLORS }}
      showsVerticalScrollIndicator={false}
      // Sticky headers ignore content padding, so each row carries the gutter.
      contentContainerStyle={{ paddingBottom: bottomInset }}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <EmptyState
          icon="receipt"
          title="No transactions this month"
          message="Tap + to log your first one."
        />
      }
      ListFooterComponent={
        count > 0 ? (
          <View style={styles.footer}>
            <Text variant="caption" tone="subtle">
              {count} {count === 1 ? "transaction" : "transactions"} ·{" "}
            </Text>
            <Amount
              cents={Math.round(spent * 100)}
              decimals="never"
              variant="caption"
              tone="subtle"
            />
            <Text variant="caption" tone="subtle">
              {" "}
              spent
            </Text>
          </View>
        ) : null
      }
    />
  );
};

const styles = StyleSheet.create({
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: SPACE.lg,
    paddingBottom: SPACE.xs,
  },
  gutter: { paddingHorizontal: SPACE.gutter },
  dimmed: { opacity: 0.4 },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: SPACE.xl,
  },
});

export default TransactionsList;

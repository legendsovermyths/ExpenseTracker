import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Animated,
  LayoutAnimation,
} from "react-native";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { Alert } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RADIUS, SPACE } from "../constants";
import { ColorPalette } from "../constants/theme";
import {
  fetchFriendLedger,
  deleteSplit,
  fetchSplitSummary,
  updateUserBalances,
  balanceImpactByFriend,
} from "../services/Splits";
import { useExpensifyStore } from "../store/store";
import { ensureTransactionsLoadedFrom } from "../services/TransactionWindow";
import { useTheme } from "../contexts/ThemeContext";
import {
  Amount,
  Avatar,
  Button,
  EmptyState,
  GlyphPlate,
  HeaderIconButton,
  Icon,
  LargeTitle,
  ListRow,
  PageBar,
  Pressable,
  SearchField,
  SkeletonList,
  Text,
  formatMoney,
  FeedbackRow,
  DeltaChip,
  useListChangeAnimation,
} from "../components/ui";
import { BAR_HEIGHT } from "../components/ui/PageBar";
import { matchesSearch } from "../services/Search";

import { useCurrency } from "../constants/currency";
interface LedgerItemRow {
  is_dirty: boolean;
  entry_id: string;
  description: string | null;
  created_at: string;
  delta_cents: number;
  transaction_id: number;
  kind: "SPLIT" | "PAYMENT";
  grp_id: string | null;
  grp_name: string | null;
}

const animateSelection = () =>
  LayoutAnimation.configureNext(
    LayoutAnimation.create(
      240,
      LayoutAnimation.Types.easeInEaseOut,
      LayoutAnimation.Properties.opacity,
    ),
  );

type ListItem =
  | { type: "month"; key: string; title: string }
  | { type: "entry"; key: string; row: LedgerItemRow; last: boolean };

const monthKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}`;
};

const monthTitle = (iso: string) => {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(
    "en-IN",
    sameYear ? { month: "long" } : { month: "long", year: "numeric" },
  );
};

const LedgerCard: React.FC<{
  item: LedgerItemRow;
  friendName: string;
  friendId: string;
  last?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  onToggle?: (item: LedgerItemRow) => void;
  onLongPress?: (item: LedgerItemRow) => void;
}> = ({
  item,
  friendName,
  friendId,
  last = false,
  selectionMode = false,
  selected = false,
  onToggle,
  onLongPress,
}) => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const navigation: any = useNavigation();
  const transactionsById = useExpensifyStore((s) => s.transactions);
  const categoriesById = useExpensifyStore((s) => s.categories);
  const hasFiles = useExpensifyStore(
    (s) => !!s.attachmentOwners[`SPLIT:${item.entry_id}`],
  );

  const positive = item.delta_cents > 0;

  // Settlement payment — a quiet centered line on paper.
  if (item.kind === "PAYMENT") {
    const label = positive
      ? `You paid ${friendName}`
      : `${friendName} paid you`;
    return (
      <View
        style={[
          styles.gutter,
          styles.paymentRow,
          selectionMode && styles.dimmed,
        ]}
      >
        <Icon name="swap-horizontal" size="sm" color={COLORS.inkSubtle} />
        <Text variant="caption" tone="muted">
          {label} · {formatMoney(Math.abs(item.delta_cents))}
        </Text>
      </View>
    );
  }

  const txn = item.transaction_id
    ? transactionsById[String(item.transaction_id)]
    : null;
  const category = txn
    ? categoriesById[String(txn.subcategory_id || txn.category_id)]
    : null;
  const colorId = txn
    ? txn.subcategory_id || txn.category_id || 0
    : item.entry_id.charCodeAt(0);
  const plateColor = COLORS.ordinal[Math.abs(colorId) % COLORS.ordinal.length];

  const subtitle = [
    new Date(item.created_at).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    }),
    item.grp_name,
    item.is_dirty ? "Pending" : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <Pressable
      scale={false}
      onLongPress={() => onLongPress?.(item)}
      delayLongPress={250}
      onPress={() => {
        if (selectionMode) {
          onToggle?.(item);
          return;
        }
        if (item.grp_id) {
          navigation.navigate("GroupExpenseSummary", {
            entryId: item.entry_id,
            grpId: item.grp_id,
          });
          return;
        }
        navigation.navigate("SplitSummary", {
          entryId: item.entry_id,
          friendName,
          friendId,
        });
      }}
      style={[styles.gutter, selectionMode && !selected && styles.dimmed]}
    >
      <ListRow
        padded={false}
        style={!last && styles.separator}
        leading={
          <GlyphPlate
            name={
              selected ? "check" : category ? category.icon_name : "call-split"
            }
            type={
              selected
                ? "material-community"
                : category
                  ? category.icon_type
                  : "material-community"
            }
            color={selected ? COLORS.accent : plateColor}
            size={40}
            radius={RADIUS.md}
          />
        }
        title={item.description || "Split"}
        subtitle={subtitle}
        trailing={
          <View style={styles.trailingWrap}>
            {hasFiles && (
              <Icon name="paperclip" size="sm" color={COLORS.inkSubtle} />
            )}
            <View style={styles.trailing}>
              <Text variant="caption" tone={positive ? "down" : "up"}>
                {positive ? "you lent" : "you borrowed"}
              </Text>
              <Amount
                cents={Math.abs(item.delta_cents)}
                tone={positive ? "down" : "up"}
              />
            </View>
          </View>
        }
      />
    </Pressable>
  );
};

const FriendLedgerScreen: React.FC = () => {
  const { COLORS } = useTheme();
  useCurrency(); // re-render when the currency changes
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const { friendId, friendName } = route.params as {
    friendId: string;
    friendName: string;
    netCents: number;
  };
  const userId = useExpensifyStore((state) => state.getUserId());
  const [showSettled, setShowSettled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [rows, setRows] = useState<LedgerItemRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  // Earliest date currently loaded — extended backward 3 months at a time
  // as the user scrolls, instead of loading the whole split history up front.
  const oldestLoadedRef = useRef<Date | null>(null);

  // Multi-select (SPLIT rows only)
  const userBalancesById = useExpensifyStore((state) => state.userbalances);
  const setUserBalancesInUI = useExpensifyStore(
    (state) => state.setUserBalances,
  );
  // The authoritative running balance — maintained server-side in
  // balance_overview, unaffected by how much ledger history is loaded here.
  // Falls back to the value passed in from the Balances list for first paint.
  const netCents =
    userBalancesById[friendId]?.net_cents ?? route.params.netCents ?? 0;
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const actionBarAnim = useRef(new Animated.Value(0)).current;
  const ledgerListRef = useRef<any>(null);

  const navigation: any = useNavigation();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  useEffect(() => {
    Animated.timing(actionBarAnim, {
      toValue: selectionMode ? 1 : 0,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [selectionMode]);

  const enterSelection = (row: LedgerItemRow) => {
    if (row.kind !== "SPLIT") return;
    animateSelection();
    setSelectionMode(true);
    setSelectedIds(new Set([row.entry_id]));
  };

  const exitSelection = () => {
    animateSelection();
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (row: LedgerItemRow) => {
    if (row.kind !== "SPLIT") return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(row.entry_id)) next.delete(row.entry_id);
      else next.add(row.entry_id);
      if (next.size === 0) {
        animateSelection();
        setSelectionMode(false);
      }
      return next;
    });
  };

  const handleBulkDeleteSplits = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    Alert.alert(
      "Delete splits",
      `Delete ${ids.length} split${ids.length === 1 ? "" : "s"}? This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // Accumulate balance reversal across all selected entries. For
              // group expenses that's every other member's pairwise share.
              const balances = { ...userBalancesById };
              for (const id of ids) {
                try {
                  const res = await fetchSplitSummary(id);
                  const impact = balanceImpactByFriend(res.items ?? [], userId);
                  Object.entries(impact).forEach(([uid, v]) => {
                    if (balances[uid]) {
                      balances[uid] = {
                        ...balances[uid],
                        net_cents: balances[uid].net_cents - v,
                      };
                    }
                  });
                  await deleteSplit(id);
                } catch {
                  /* skip failed */
                }
              }
              await updateUserBalances(Object.values(balances));
              setUserBalancesInUI(Object.values(balances));
            } finally {
              exitSelection();
              fetchLedger();
            }
          },
        },
      ],
    );
  };

  const handleBulkEditSplits = () => {
    // Group expenses have their own editor (more than two people).
    const groupIds = new Set(
      rows.filter((r) => r.grp_id).map((r) => r.entry_id),
    );
    const queue = Array.from(selectedIds)
      .filter((entryId) => !groupIds.has(entryId))
      .map((entryId) => ({ __entryId: entryId }));
    if (queue.length === 0) {
      Alert.alert("Group expenses", "Edit group expenses from their group.");
      return;
    }
    exitSelection();
    navigation.navigate("SplitInputScreen", {
      bulkQueue: queue,
      bulkIndex: 0,
      bulkMode: "edit",
      userId: friendId,
      userName: friendName,
    });
  };

  const handleAddToTransaction = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const queue: any[] = [];
    for (const id of ids) {
      try {
        const res = await fetchSplitSummary(id);
        const meItem = (res.items ?? []).find((i: any) => i.user_id === userId);
        const myOwe = meItem?.owed_cents ?? 0;
        queue.push({
          description: res.description || "Split",
          amount: myOwe / 100,
          is_credit: false,
          date: res.created_at,
          __entryId: id,
        });
      } catch {
        /* skip failed */
      }
    }
    if (queue.length === 0) return;
    exitSelection();
    navigation.navigate("TransactionEdit", {
      prefill: queue[0],
      bulkQueue: queue,
      bulkIndex: 0,
    });
  };

  const BATCH_MONTHS = 3;

  // Groups the raw line_item/ledger_entry rows for one fetch batch into
  // display rows. Pure — safe to call per-batch and merge the results.
  const groupLedgerRows = (li: any[], me: string): LedgerItemRow[] => {
    const map = new Map<
      string,
      {
        desc: string | null;
        created_at: string;
        delta: number;
        seen_me: boolean;
        seen_friend: boolean;
        kind: "PAYMENT" | "SPLIT";
        transaction_id: number | null;
        is_dirty: boolean;
        grp_id: string | null;
        grp_name: string | null;
      }
    >();
    li.forEach((row: any) => {
      const id = row.entry_id;
      if (!map.has(id)) {
        map.set(id, {
          desc: row.description || null,
          created_at: row.created_at,
          delta: 0,
          seen_me: false,
          seen_friend: false,
          kind: row.kind,
          transaction_id: row.transaction_id || null,
          is_dirty: row.is_dirty,
          grp_id: row.grp_id ?? null,
          grp_name: row.grp_name ?? null,
        });
      }
      const obj = map.get(id)!;
      if (row.user_id == me) {
        obj.delta += row.amount_cents;
        obj.seen_me = true;
      } else if (row.user_id == friendId) {
        obj.delta += 0;
        obj.seen_friend = true;
      }
    });
    const out: LedgerItemRow[] = [];
    map.forEach((v, k) => {
      if (v.seen_me && v.seen_friend) {
        out.push({
          entry_id: k,
          description: v.desc,
          created_at: v.created_at,
          delta_cents: v.delta,
          kind: v.kind,
          transaction_id: v.transaction_id,
          is_dirty: v.is_dirty,
          grp_id: v.grp_id,
          grp_name: v.grp_name,
        });
      }
    });
    return out;
  };

  // Ledger rows can link to transactions older than the 6-month hot window
  // — pull in older batches so LedgerCard's linked-transaction lookup
  // (category/icon) isn't silently missing for old splits.
  const preloadLinkedTransactions = async (batchRows: LedgerItemRow[]) => {
    const linkedDates = batchRows
      .filter((r) => r.transaction_id)
      .map((r) => new Date(r.created_at).getTime());
    if (linkedDates.length > 0) {
      await ensureTransactionsLoadedFrom(new Date(Math.min(...linkedDates)));
    }
  };

  const fetchLedger = async () => {
    setLoading(true);
    setError(null);
    try {
      const me = userId;
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - BATCH_MONTHS);
      const li = await fetchFriendLedger(me, friendId, startDate.toISOString());
      if (!li) return;
      const finalRows = groupLedgerRows(li, me).sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setRows(finalRows);
      oldestLoadedRef.current = startDate;
      setHasMore(true);

      await preloadLinkedTransactions(finalRows);
    } catch (e: any) {
      setError(e.message || "Failed to fetch ledger");
    } finally {
      setLoading(false);
    }
  };

  // A single 3-month-wide gap with no activity doesn't mean there's nothing
  // further back (splits can be sporadic) — keep stepping back through empty
  // batches before giving up, same reasoning as the transactions window's
  // batch cap (services/TransactionWindow.ts).
  const MAX_EMPTY_BATCHES = 40; // ~10 years of consecutive-empty look-back

  const loadMoreLedger = async () => {
    if (loadingMore || !hasMore || !oldestLoadedRef.current) return;
    setLoadingMore(true);
    try {
      const me = userId;
      let endDate = oldestLoadedRef.current;
      for (let attempt = 0; attempt < MAX_EMPTY_BATCHES; attempt++) {
        const startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - BATCH_MONTHS);
        const li = await fetchFriendLedger(
          me,
          friendId,
          startDate.toISOString(),
          endDate.toISOString(),
        );
        const newRows = groupLedgerRows(li ?? [], me);
        oldestLoadedRef.current = startDate;
        endDate = startDate;

        if (newRows.length > 0) {
          setRows((prev) => {
            const merged = new Map(prev.map((r) => [r.entry_id, r]));
            newRows.forEach((r) => merged.set(r.entry_id, r));
            return Array.from(merged.values()).sort(
              (a, b) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime(),
            );
          });
          await preloadLinkedTransactions(newRows);
          return;
        }
      }
      // Exhausted the look-back cap without finding anything further back.
      setHasMore(false);
    } catch {
      // leave hasMore as-is — the next scroll/attempt can retry
    } finally {
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchLedger();
    }, []),
  );

  const isZero = netCents <= 1 && netCents >= -1;
  const overallPositive = netCents > 0;

  // The "collapsed" view: walk from newest, keep rows until the running
  // balance reaches the net — everything past that has already settled out.
  // The headline balance itself always comes from the authoritative
  // userbalances store (see `netCents` above), so it's correct regardless of
  // how much ledger history is loaded — but this collapse needs enough rows
  // loaded to actually find that boundary, hence `reachedBalance` below.
  let collapsedRows: LedgerItemRow[] = [];
  let running = 0;
  let reachedBalance = isZero;
  for (const r of rows) {
    running += r.delta_cents;
    collapsedRows.push(r);
    if (running === netCents) {
      reachedBalance = true;
      break;
    }
  }
  if (isZero) collapsedRows = [];
  const canToggleSettled = rows.length > collapsedRows.length;

  // If there's a real (nonzero) balance but the loaded window can't account
  // for it yet, keep pulling in older batches automatically — not just on
  // scroll — so a dormant-then-unsettled friend never looks "all settled up"
  // just because the recent window happens to be empty.
  useEffect(() => {
    if (!loading && !loadingMore && !reachedBalance && hasMore) {
      loadMoreLedger();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reachedBalance, hasMore, loading, loadingMore, rows]);

  // Build the visible list: search filter takes precedence over the
  // "hide settled" collapse.
  let visibleRows: LedgerItemRow[];
  if (query.trim()) {
    visibleRows = rows.filter((r) =>
      matchesSearch(
        query,
        r.description,
        (Math.abs(r.delta_cents) / 100).toFixed(2),
        Math.abs(r.delta_cents) / 100,
      ),
    );
  } else {
    visibleRows = showSettled ? rows : collapsedRows;
  }

  // Running total of the current selection — shown in the selection bar.
  const selectedTotalCents = rows.reduce(
    (sum, r) =>
      selectedIds.has(r.entry_id) ? sum + Math.abs(r.delta_cents) : sum,
    0,
  );

  const handleAddSplit = () => {
    navigation.navigate("SplitInputScreen", {
      userId: friendId,
      userName: friendName,
    });
  };
  const handleSettle = () => {
    const meId = userId;
    navigation.navigate("SettleScreen", {
      payerId: overallPositive ? friendId : meId,
      payerName: overallPositive ? friendName : "You",
      payeeId: overallPositive ? meId : friendId,
      payeeName: overallPositive ? "You" : friendName,
      amountCents: Math.abs(netCents),
    });
  };

  const overallLabel = isZero
    ? "You're all settled up"
    : overallPositive
      ? "Overall, you are owed"
      : "Overall, you owe";
  const overallTone = isZero ? "muted" : overallPositive ? "down" : "up";
  const scrollY = useSharedValue(0);

  // Month sections with sticky headers. Sticky headers ignore content
  // padding, so every row carries the gutter itself.
  useListChangeAnimation(
    visibleRows.map((r) => r.entry_id),
    ledgerListRef,
  );
  const listItems: ListItem[] = [];
  const stickyIndices: number[] = [];
  let currentMonth = "";
  visibleRows.forEach((r, i) => {
    const k = monthKey(r.created_at);
    if (k !== currentMonth) {
      currentMonth = k;
      stickyIndices.push(listItems.length);
      listItems.push({
        type: "month",
        key: `m-${k}`,
        title: monthTitle(r.created_at),
      });
    }
    const next = visibleRows[i + 1];
    listItems.push({
      type: "entry",
      key: r.entry_id,
      row: r,
      last: !next || monthKey(next.created_at) !== k,
    });
  });

  const title = selectionMode ? (
    <LargeTitle
      topInset={false}
      title={`${selectedIds.size} selected`}
      subtitle={formatMoney(selectedTotalCents)}
      right={
        <HeaderIconButton
          icon="close"
          label="Cancel selection"
          tone="ink"
          onPress={exitSelection}
        />
      }
    />
  ) : (
    <LargeTitle
      topInset={false}
      title={friendName}
      right={
        <>
          {!searching && (
            <HeaderIconButton
              icon="magnify"
              label="Search splits"
              tone="ink"
              onPress={() => setSearching(true)}
            />
          )}
          <HeaderIconButton
            icon="handshake-outline"
            label="Settle up"
            onPress={handleSettle}
          />
          <HeaderIconButton
            icon="plus"
            label="Add split"
            onPress={handleAddSplit}
          />
        </>
      }
    />
  );

  const renderBody = () => {
    if (loading) {
      return (
        <View style={styles.gutter}>
          <SkeletonList rows={6} />
        </View>
      );
    }
    if (error) {
      return (
        <EmptyState
          icon="alert-circle-outline"
          title="Couldn't load splits"
          message={error}
          actionLabel="Retry"
          onAction={fetchLedger}
        />
      );
    }
    return (
      <FlashList
        ref={ledgerListRef}
        showsVerticalScrollIndicator={false}
        data={listItems}
        keyExtractor={(item) => item.key}
        getItemType={(item) => item.type}
        stickyHeaderIndices={stickyIndices}
        estimatedItemSize={64}
        extraData={{ selectionMode, selectedIds, COLORS }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) =>
          item.type === "month" ? (
            <View style={[styles.gutter, styles.monthRow]}>
              <Text variant="label" tone="muted">
                {item.title}
              </Text>
            </View>
          ) : (
            <FeedbackRow kind="split" id={item.row.entry_id}>
              <LedgerCard
                item={item.row}
                friendName={friendName}
                friendId={friendId}
                last={item.last}
                selectionMode={selectionMode}
                selected={selectedIds.has(item.row.entry_id)}
                onToggle={toggleSelect}
                onLongPress={enterSelection}
              />
            </FeedbackRow>
          )
        }
        contentContainerStyle={{
          paddingBottom: selectionMode ? 120 : insets.bottom + SPACE.xl,
        }}
        onEndReached={() => {
          // Only reach further back when showing the full (uncollapsed,
          // unfiltered) list — the collapsed/settled view doesn't need it.
          if (!query.trim() && showSettled) loadMoreLedger();
        }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={() => {
          if (query.trim()) {
            return (
              <EmptyState
                icon="magnify"
                title="No matching splits"
                message="Try a description or an amount."
              />
            );
          }
          // There's a real balance but nothing loaded yet explains it —
          // still searching further back, not actually settled.
          if (!reachedBalance && hasMore) {
            return (
              <View style={styles.gutter}>
                <SkeletonList rows={3} />
              </View>
            );
          }
          return (
            <EmptyState
              icon="check-circle-outline"
              title="All settled up!"
              message={`Nothing outstanding with ${friendName}.`}
            />
          );
        }}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator style={styles.footer} color={COLORS.accent} />
          ) : !query.trim() && canToggleSettled ? (
            <View style={styles.footer}>
              <Button
                variant="secondary"
                title={
                  showSettled
                    ? "Hide settled transactions"
                    : "Show settled transactions"
                }
                onPress={() => setShowSettled((s) => !s)}
              />
            </View>
          ) : null
        }
      />
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + BAR_HEIGHT }]}>
      {title}

      {/* Balance headline (hidden while searching to keep focus).
          Kept mounted during selection so the list never shifts. */}
      {searching ? (
        <View style={[styles.gutter, styles.searchRow]}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder={`Search splits with ${friendName}`}
            autoFocus
            style={styles.flex}
          />
          <Pressable
            onPress={() => {
              setQuery("");
              setSearching(false);
            }}
            accessibilityLabel="Close search"
          >
            <Text variant="headline" tone="accent">
              Cancel
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.gutter, styles.headline]}>
          <View style={styles.flex}>
            {isZero ? (
              <Text variant="title" tone="muted">
                {overallLabel}
              </Text>
            ) : (
              <>
                <Text variant="body" tone="muted">
                  {overallLabel}
                </Text>
                <View style={styles.netRow}>
                  <Amount
                    cents={Math.abs(netCents)}
                    variant="amountLarge"
                    tone={overallTone}
                    animated
                  />
                  <DeltaChip totalKey={`friend:${friendId}`} positiveIsGood />
                </View>
              </>
            )}
          </View>
          <Avatar name={friendName} size={44} />
        </View>
      )}

      <View style={styles.flex}>{renderBody()}</View>

      {/* Selection action bar — slides up from the bottom */}
      <Animated.View
        pointerEvents={selectionMode ? "auto" : "none"}
        style={[
          styles.actionBar,
          { paddingBottom: Math.max(insets.bottom, SPACE.lg) },
          {
            opacity: actionBarAnim,
            transform: [
              {
                translateY: actionBarAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [140, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Button
          variant="secondary"
          title="Edit split"
          onPress={handleBulkEditSplits}
          disabled={selectedIds.size === 0}
          style={styles.actionBtn}
        />
        <Button
          variant="secondary"
          title="Add to txn"
          onPress={handleAddToTransaction}
          disabled={selectedIds.size === 0}
          style={styles.actionBtn}
        />
        <Button
          variant="destructive"
          title="Delete"
          onPress={handleBulkDeleteSplits}
          disabled={selectedIds.size === 0}
          style={styles.actionBtn}
        />
      </Animated.View>

      <PageBar title={friendName} scrollY={scrollY} />
    </View>
  );
};

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    netRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
    screen: { flex: 1, backgroundColor: COLORS.paper },
    flex: { flex: 1 },
    gutter: { paddingHorizontal: SPACE.gutter },
    dimmed: { opacity: 0.4 },

    // Headline
    headline: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACE.md,
      paddingTop: SPACE.xs,
      paddingBottom: SPACE.md,
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACE.md,
      paddingTop: SPACE.xs,
      paddingBottom: SPACE.sm,
    },

    // List
    monthRow: {
      paddingTop: SPACE.lg,
      paddingBottom: SPACE.xs,
      backgroundColor: COLORS.paper,
    },
    separator: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.hairline,
    },
    trailingWrap: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
    trailing: { alignItems: "flex-end" },
    paymentRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: SPACE.xs,
      paddingVertical: SPACE.md,
    },
    footer: { alignItems: "center", paddingVertical: SPACE.md },

    // Selection action bar
    actionBar: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACE.sm,
      paddingTop: SPACE.md,
      paddingHorizontal: SPACE.gutter,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.hairline,
      backgroundColor: COLORS.paper,
    },
    actionBtn: { flex: 1, paddingHorizontal: SPACE.xs },
  });

export default FriendLedgerScreen;

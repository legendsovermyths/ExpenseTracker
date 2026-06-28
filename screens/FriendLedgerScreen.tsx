import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  LayoutAnimation,
} from "react-native";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { Alert } from "react-native";
import { Icon } from "react-native-elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONTS, SIZES } from "../constants";
import { ColorPalette } from "../constants/theme";
import {
  fetchFriendLedger,
  deleteSplit,
  fetchSplitSummary,
  updateUserBalances,
} from "../services/Splits";
import { formatAmountWithCommas } from "../services/Utils";
import { useExpensifyStore } from "../store/store";
import { useTheme } from "../contexts/ThemeContext";
import { Avatar, GlyphPlate } from "../components/primitives";

interface LedgerItemRow {
  is_dirty: boolean;
  entry_id: string;
  description: string | null;
  created_at: string;
  delta_cents: number;
  transaction_id: number;
  kind: "SPLIT" | "PAYMENT";
}

const fmt = (cents: number) => `₹${formatAmountWithCommas(Math.abs(cents) / 100, true)}`;

const animateSelection = () =>
  LayoutAnimation.configureNext(
    LayoutAnimation.create(
      240,
      LayoutAnimation.Types.easeInEaseOut,
      LayoutAnimation.Properties.opacity,
    ),
  );

const LedgerCard: React.FC<{
  item: LedgerItemRow;
  friendName: string;
  friendId: string;
  selectionMode?: boolean;
  selected?: boolean;
  onToggle?: (item: LedgerItemRow) => void;
  onLongPress?: (item: LedgerItemRow) => void;
}> = ({ item, friendName, friendId, selectionMode = false, selected = false, onToggle, onLongPress }) => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const navigation: any = useNavigation();
  const transactionsById = useExpensifyStore((s) => s.transactions);
  const categoriesById = useExpensifyStore((s) => s.categories);

  const positive = item.delta_cents > 0;

  // Settlement payment — slim, centered, muted pill.
  if (item.kind === "PAYMENT") {
    const label = positive ? `You paid ${friendName}` : `${friendName} paid you`;
    return (
      <View style={styles.paymentRow}>
        <View style={styles.paymentPill}>
          <Icon name="swap-horizontal" type="material-community" size={15} color={COLORS.inkMuted} />
          <Text style={styles.paymentText}>
            {label} · {fmt(item.delta_cents)}
          </Text>
        </View>
      </View>
    );
  }

  const txn = item.transaction_id ? transactionsById[String(item.transaction_id)] : null;
  const category = txn
    ? categoriesById[String(txn.subcategory_id || txn.category_id)]
    : null;
  const colorId = txn
    ? txn.subcategory_id || txn.category_id || 0
    : item.entry_id.charCodeAt(0);
  const plateColor = COLORS.ordinal[Math.abs(colorId) % COLORS.ordinal.length];

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onLongPress={() => onLongPress?.(item)}
      delayLongPress={250}
      onPress={() => {
        if (selectionMode) {
          onToggle?.(item);
          return;
        }
        navigation.navigate("SplitSummary", {
          entryId: item.entry_id,
          friendName,
          friendId,
        });
      }}
    >
      <View style={[styles.cardRow, selectionMode && !selected && styles.dimmed]}>
        <GlyphPlate
          name={selected ? "check" : category ? category.icon_name : "call-split"}
          type={selected ? "material-community" : category ? category.icon_type : "material-community"}
          color={selected ? COLORS.accent : plateColor}
          size={42}
          radius={12}
        />
        <View style={styles.cardInfo}>
          <Text style={styles.descText} numberOfLines={1}>
            {item.description || "Split"}
          </Text>
          <Text style={styles.dateText}>
            {new Date(item.created_at).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            })}
            {item.is_dirty ? "  ·  Pending" : ""}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text
            style={[
              styles.lentLabel,
              { color: positive ? COLORS.deltaDown : COLORS.deltaUp },
            ]}
          >
            {positive ? "you lent" : "you borrowed"}
          </Text>
          <Text
            style={[
              styles.lentAmount,
              { color: positive ? COLORS.deltaDown : COLORS.deltaUp },
            ]}
          >
            {fmt(item.delta_cents)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const FriendLedgerScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const { friendId, friendName } = route.params as {
    friendId: string;
    friendName: string;
    netCents: number;
  };
  const userId = useExpensifyStore((state) => state.getUserId());
  const [netCents, setNetCents] = useState(0);
  const [showSettled, setShowSettled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LedgerItemRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");

  // Multi-select (SPLIT rows only)
  const userBalancesById = useExpensifyStore((state) => state.userbalances);
  const setUserBalancesInUI = useExpensifyStore((state) => state.setUserBalances);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const actionBarAnim = useRef(new Animated.Value(0)).current;

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
              // Accumulate balance reversal across all selected entries, mirroring
              // SplitSummary.handleDelete (impact = friend.owed - friend.paid).
              const balances = { ...userBalancesById };
              for (const id of ids) {
                try {
                  const res = await fetchSplitSummary(id);
                  (res.items ?? []).forEach((item: any) => {
                    if (item.user_id !== userId && balances[item.user_id]) {
                      const impact = item.owed_cents - item.paid_cents;
                      balances[item.user_id] = {
                        ...balances[item.user_id],
                        net_cents: balances[item.user_id].net_cents - impact,
                      };
                    }
                  });
                  await deleteSplit(id);
                } catch { /* skip failed */ }
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
    const queue = Array.from(selectedIds).map((entryId) => ({ __entryId: entryId }));
    if (queue.length === 0) return;
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
      } catch { /* skip failed */ }
    }
    if (queue.length === 0) return;
    exitSelection();
    navigation.navigate("TransactionEdit", {
      prefill: queue[0],
      bulkQueue: queue,
      bulkIndex: 0,
    });
  };

  const fetchLedger = async () => {
    setLoading(true);
    setError(null);
    try {
      const me = userId;
      const li = await fetchFriendLedger(me, friendId);
      if (!li) return;
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
      const finalRows: LedgerItemRow[] = [];
      map.forEach((v, k) => {
        if (v.seen_me && v.seen_friend) {
          finalRows.push({
            entry_id: k,
            description: v.desc,
            created_at: v.created_at,
            delta_cents: v.delta,
            kind: v.kind,
            transaction_id: v.transaction_id,
            is_dirty: v.is_dirty,
          });
        }
      });
      finalRows.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      const cents = finalRows.reduce((acc, row) => acc + row.delta_cents, 0);
      setNetCents(cents);
      setRows(finalRows);
    } catch (e: any) {
      setError(e.message || "Failed to fetch ledger");
    } finally {
      setLoading(false);
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
  let collapsedRows: LedgerItemRow[] = [];
  let running = 0;
  for (const r of rows) {
    running += r.delta_cents;
    collapsedRows.push(r);
    if (running === netCents) break;
  }
  if (isZero) collapsedRows = [];
  const canToggleSettled = rows.length > collapsedRows.length;

  // Build the visible list: search filter takes precedence over the
  // "hide settled" collapse.
  let visibleRows: LedgerItemRow[];
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    visibleRows = rows.filter(
      (r) =>
        (r.description || "").toLowerCase().includes(q) ||
        (Math.abs(r.delta_cents) / 100).toString().includes(q),
    );
  } else {
    visibleRows = showSettled ? rows : collapsedRows;
  }

  // Running total of the current selection — shown in the selection bar.
  const selectedTotalCents = rows.reduce(
    (sum, r) => (selectedIds.has(r.entry_id) ? sum + Math.abs(r.delta_cents) : sum),
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
  const overallColor = isZero
    ? COLORS.neutral
    : overallPositive
      ? COLORS.deltaDown
      : COLORS.deltaUp;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: COLORS.deltaUp, marginBottom: SIZES.base }}>{error}</Text>
        <TouchableOpacity onPress={fetchLedger} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Selection top bar */}
      {selectionMode ? (
        <View style={[styles.header, { paddingTop: insets.top + SIZES.base }]}>
          <TouchableOpacity onPress={exitSelection} style={styles.headerBtn}>
            <Icon name="close" type="material-community" size={24} color={COLORS.ink} />
          </TouchableOpacity>
          <Text style={[styles.headerName, { flex: 1 }]}>
            {selectedIds.size} · {fmt(selectedTotalCents)}
          </Text>
        </View>
      ) : (
      /* Header */
      <View style={[styles.header, { paddingTop: insets.top + SIZES.base }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="arrow-left" type="material-community" size={24} color={COLORS.ink} />
        </TouchableOpacity>
        {searching ? (
          <View style={styles.searchBox}>
            <Icon name="magnify" type="material-community" size={18} color={COLORS.inkMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder={`Search splits with ${friendName}`}
              placeholderTextColor={COLORS.inkSubtle}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            <TouchableOpacity
              onPress={() => {
                setQuery("");
                setSearching(false);
              }}
            >
              <Icon name="close" type="material-community" size={18} color={COLORS.inkMuted} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.headerIdentity}>
              <Avatar name={friendName} size={30} />
              <Text style={styles.headerName} numberOfLines={1}>{friendName}</Text>
            </View>
            <TouchableOpacity onPress={() => setSearching(true)} style={styles.headerBtn}>
              <Icon name="magnify" type="material-community" size={24} color={COLORS.ink} />
            </TouchableOpacity>
          </>
        )}
      </View>
      )}

      {/* Balance hero + actions (hidden while searching to keep focus).
          Kept mounted during selection so the list never shifts. */}
      {!searching && (
        <View style={styles.heroBlock}>
          <Text style={styles.overallLabel}>{overallLabel}</Text>
          {!isZero && (
            <Text style={[styles.overallAmount, { color: overallColor }]}>{fmt(netCents)}</Text>
          )}
          <View style={styles.buttonsRow}>
            <TouchableOpacity style={styles.settleBtn} onPress={handleSettle} activeOpacity={0.8}>
              <Text style={styles.settleText}>Settle up</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={handleAddSplit} activeOpacity={0.85}>
              <Icon name="plus" type="material-community" size={18} color={COLORS.paper} />
              <Text style={styles.addText}>Add split</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FlatList
        showsVerticalScrollIndicator={false}
        data={visibleRows}
        keyExtractor={(item) => item.entry_id}
        renderItem={({ item }) => (
          <LedgerCard
            item={item}
            friendName={friendName}
            friendId={friendId}
            selectionMode={selectionMode}
            selected={selectedIds.has(item.entry_id)}
            onToggle={toggleSelect}
            onLongPress={enterSelection}
          />
        )}
        contentContainerStyle={[styles.listContent, selectionMode && { paddingBottom: 120 }]}
        ListEmptyComponent={() => (
          <Text style={styles.emptyText}>
            {query.trim() ? "No matching splits" : "All settled up!"}
          </Text>
        )}
        ListFooterComponent={
          !query.trim() && canToggleSettled ? (
            <TouchableOpacity
              onPress={() => setShowSettled((s) => !s)}
              style={styles.showSettledBtn}
            >
              <Text style={styles.showSettledText}>
                {showSettled ? "Hide settled transactions" : "Show settled transactions"}
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {/* Selection action bar — slides up from the bottom */}
      <Animated.View
        pointerEvents={selectionMode ? "auto" : "none"}
        style={[
          styles.actionBar,
          { paddingBottom: insets.bottom + SIZES.base },
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
        <TouchableOpacity
          style={styles.actionItem}
          onPress={handleBulkEditSplits}
          disabled={selectedIds.size === 0}
        >
          <Icon name="pencil" type="material-community" size={22} color={COLORS.accent} />
          <Text style={[styles.actionText, { color: COLORS.accent }]}>Edit split</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionItem}
          onPress={handleAddToTransaction}
          disabled={selectedIds.size === 0}
        >
          <Icon name="bank-transfer-in" type="material-community" size={22} color={COLORS.ink} />
          <Text style={[styles.actionText, { color: COLORS.ink }]}>Add to txn</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionItem}
          onPress={handleBulkDeleteSplits}
          disabled={selectedIds.size === 0}
        >
          <Icon name="trash-can-outline" type="material-community" size={22} color={COLORS.deltaUp} />
          <Text style={[styles.actionText, { color: COLORS.deltaUp }]}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.paper },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: COLORS.paper,
    },
    retryBtn: {
      paddingHorizontal: SIZES.padding,
      paddingVertical: SIZES.base,
      borderRadius: SIZES.radius,
      borderWidth: 1,
      borderColor: COLORS.hairline,
    },
    retryText: { ...FONTS.body3, color: COLORS.ink },

    // Header
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: SIZES.padding,
      paddingBottom: SIZES.base,
      gap: SIZES.base,
    },
    headerBtn: { padding: 4 },
    headerIdentity: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: SIZES.base + 2,
    },
    headerName: { ...FONTS.h2, color: COLORS.ink, flex: 1 },
    searchBox: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: SIZES.base,
      backgroundColor: COLORS.surface1,
      borderRadius: 10,
      paddingHorizontal: SIZES.base + 2,
    },
    searchInput: {
      flex: 1,
      ...FONTS.body3,
      color: COLORS.ink,
      paddingVertical: SIZES.base,
    },

    // Hero
    heroBlock: {
      paddingHorizontal: SIZES.padding,
      paddingTop: SIZES.base,
      paddingBottom: SIZES.base + 4,
    },
    overallLabel: { ...FONTS.bodyS, color: COLORS.inkMuted },
    overallAmount: { ...FONTS.amountSection, marginTop: 2 },
    buttonsRow: {
      flexDirection: "row",
      gap: SIZES.base + 2,
      marginTop: SIZES.padding * 0.6,
    },
    settleBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: SIZES.radius,
      borderWidth: 1,
      borderColor: COLORS.accent,
    },
    settleText: { ...FONTS.h4, color: COLORS.accent },
    addBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: SIZES.radius,
      backgroundColor: COLORS.accent,
    },
    addText: { ...FONTS.h4, color: COLORS.paper },

    // List
    listContent: {
      paddingHorizontal: SIZES.padding,
      paddingBottom: SIZES.padding,
    },
    cardRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: SIZES.base + 2,
      gap: 12,
    },
    dimmed: {
      opacity: 0.4,
    },
    actionBar: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
      paddingTop: SIZES.base + 4,
      paddingHorizontal: SIZES.padding,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.hairline,
      backgroundColor: COLORS.paper,
    },
    actionItem: {
      alignItems: "center",
      gap: 3,
      paddingHorizontal: SIZES.base,
    },
    actionText: {
      ...FONTS.caption,
      letterSpacing: 0.3,
    },
    cardInfo: { flex: 1 },
    descText: { ...FONTS.bodyM, fontFamily: "Roboto-Bold", color: COLORS.ink },
    dateText: { ...FONTS.caption, color: COLORS.inkMuted, marginTop: 2 },
    lentLabel: { ...FONTS.caption, marginBottom: 2 },
    lentAmount: { ...FONTS.amountInline, fontSize: 16 },

    // Payment pill
    paymentRow: { alignItems: "center", paddingVertical: SIZES.base },
    paymentPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: COLORS.surface1,
      paddingHorizontal: SIZES.base + 4,
      paddingVertical: 6,
      borderRadius: 16,
    },
    paymentText: { ...FONTS.caption, color: COLORS.inkMuted },

    emptyText: {
      textAlign: "center",
      marginTop: 30,
      ...FONTS.body3,
      color: COLORS.inkMuted,
    },
    showSettledBtn: { alignSelf: "center", marginVertical: 10 },
    showSettledText: { ...FONTS.bodyS, color: COLORS.inkMuted },
  });

export default FriendLedgerScreen;

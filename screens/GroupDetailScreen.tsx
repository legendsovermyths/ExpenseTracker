import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { Icon } from "react-native-elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONTS, SIZES } from "../constants";
import { ColorPalette } from "../constants/theme";
import { useTheme } from "../contexts/ThemeContext";
import { useExpensifyStore } from "../store/store";
import { fetchGroupDetail } from "../services/Groups";
import { syncSplitsNow } from "../services/BackgroundSync";
import { formatAmountWithCommas } from "../services/Utils";
import { Avatar, GlyphPlate } from "../components/primitives";
import { GroupDetail, GroupExpense } from "../types/entity/Group";

const fmt = (cents: number) => `₹${formatAmountWithCommas(Math.abs(cents) / 100, true)}`;

const GroupDetailScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();
  const navigation: any = useNavigation();
  const route = useRoute<any>();
  const { grpId } = route.params as { grpId: string };
  const me = useExpensifyStore((s) => s.getUserId());
  const transactionsById = useExpensifyStore((s) => s.transactions);
  const categoriesById = useExpensifyStore((s) => s.categories);

  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      setDetail(await fetchGroupDetail(grpId, me));
    } catch (e) {
      console.warn("fetchGroupDetail failed", e);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await syncSplitsNow();
    } catch {
      // offline — show local data
    }
    await load();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [grpId]),
  );

  if (!detail) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  const nameOf = (id: string) =>
    id === me
      ? "You"
      : detail.members.find((m) => m.user_id === id)?.user_name || "Someone";

  const net = detail.my_net_cents;
  const settled = Math.abs(net) <= 1;
  const netColor = settled ? COLORS.neutral : net > 0 ? COLORS.deltaDown : COLORS.deltaUp;
  const netLabel = settled
    ? "You're all settled up"
    : net > 0
      ? `You're owed ${fmt(net)}`
      : `You owe ${fmt(net)}`;

  const renderExpense = ({ item }: { item: GroupExpense }) => {
    const txn = item.transaction_id ? transactionsById[String(item.transaction_id)] : null;
    const category = txn ? categoriesById[String(txn.subcategory_id || txn.category_id)] : null;
    const plateColor = COLORS.ordinal[Math.abs(item.entry_id.charCodeAt(0)) % COLORS.ordinal.length];
    const payers = item.payer_ids.map(nameOf);
    const paidBy =
      payers.length === 0 ? "" : payers.length === 1 ? `${payers[0]} paid` : `${payers.length} people paid`;
    const mine = item.my_net_cents;
    const isPayment = item.kind === "PAYMENT";
    const mineLabel =
      mine === 0 ? "not involved" : mine > 0 ? "you lent" : "you borrowed";
    const mineColor =
      mine === 0 ? COLORS.inkMuted : mine > 0 ? COLORS.deltaDown : COLORS.deltaUp;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate("GroupExpenseSummary", { entryId: item.entry_id, grpId })
        }
      >
        <View style={styles.row}>
          <GlyphPlate
            name={isPayment ? "swap-horizontal" : category ? category.icon_name : "receipt"}
            type={category && !isPayment ? category.icon_type : "material-community"}
            color={plateColor}
            size={42}
            radius={12}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {item.description || (isPayment ? "Payment" : "Expense")}
            </Text>
            <Text style={styles.rowSub} numberOfLines={1}>
              {new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              {paidBy ? `  ·  ${paidBy} ${fmt(item.total_cents)}` : ""}
              {item.is_dirty ? "  ·  Pending" : ""}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[styles.rowLabel, { color: mineColor }]}>{mineLabel}</Text>
            {mine !== 0 && (
              <Text style={[styles.rowAmount, { color: mineColor }]}>{fmt(mine)}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const header = (
    <View>
      <View style={styles.summaryCard}>
        <Text style={[styles.netText, { color: netColor }]}>{netLabel}</Text>
        <Text style={styles.totalText}>
          {detail.members.length} members · {fmt(detail.total_spent_cents)} spent
        </Text>
      </View>

      {detail.member_balances.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Balances</Text>
          {detail.member_balances.map((b) => {
            const n = nameOf(b.user_id);
            const zero = Math.abs(b.net_cents) <= 1;
            const color = zero ? COLORS.neutral : b.net_cents > 0 ? COLORS.deltaDown : COLORS.deltaUp;
            return (
              <TouchableOpacity
                key={b.user_id}
                style={styles.balanceRow}
                activeOpacity={0.7}
                onPress={() =>
                  navigation.navigate("FriendLedgerScreen", {
                    friendId: b.user_id,
                    friendName: n,
                  })
                }
              >
                <Avatar name={n} size={32} />
                <Text style={styles.balanceName} numberOfLines={1}>{n}</Text>
                <Text style={[styles.balanceAmt, { color }]}>
                  {zero ? "settled" : b.net_cents > 0 ? `owes you ${fmt(b.net_cents)}` : `you owe ${fmt(b.net_cents)}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </>
      )}

      <Text style={[styles.sectionLabel, { marginTop: SIZES.padding }]}>Expenses</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="arrow-left" type="material-community" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{detail.group.name}</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("CreateGroupScreen", { grpId })}
          style={styles.headerBtn}
        >
          <Icon name="cog-outline" type="material-community" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={detail.expenses}
        keyExtractor={(e) => e.entry_id}
        renderItem={renderExpense}
        ListHeaderComponent={header}
        ListEmptyComponent={<Text style={styles.emptyText}>No expenses yet</Text>}
        contentContainerStyle={{ paddingHorizontal: SIZES.padding, paddingBottom: 120 }}
        refreshing={refreshing}
        onRefresh={refresh}
      />

      <TouchableOpacity
        style={[styles.addBtn, { bottom: insets.bottom + SIZES.padding }]}
        activeOpacity={0.85}
        onPress={() => navigation.navigate("AddGroupExpense", { grpId })}
      >
        <Icon name="plus" type="material-community" size={20} color={COLORS.white} />
        <Text style={styles.addBtnText}>Add expense</Text>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.white },
    centered: { justifyContent: "center", alignItems: "center" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: SIZES.padding,
      paddingTop: SIZES.padding * 2.5,
      paddingBottom: SIZES.base,
      gap: SIZES.base,
    },
    headerBtn: { padding: 4 },
    headerTitle: { ...FONTS.h3, fontWeight: "600", color: COLORS.primary, flex: 1, textAlign: "center" },
    summaryCard: {
      backgroundColor: COLORS.surface1,
      borderRadius: 14,
      padding: SIZES.padding * 0.8,
      marginVertical: SIZES.base + 4,
      alignItems: "center",
    },
    netText: { ...FONTS.h2, fontWeight: "700" },
    totalText: { ...FONTS.body4, color: COLORS.inkMuted, marginTop: 4 },
    sectionLabel: {
      ...FONTS.caption,
      color: COLORS.inkMuted,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      marginTop: SIZES.base,
      marginBottom: SIZES.base,
    },
    balanceRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 6,
    },
    balanceName: { ...FONTS.body3, color: COLORS.ink, fontWeight: "500", flex: 1 },
    balanceAmt: { ...FONTS.body4, fontWeight: "600" },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: SIZES.base + 2,
    },
    rowTitle: { ...FONTS.body3, color: COLORS.ink, fontWeight: "500" },
    rowSub: { ...FONTS.caption, color: COLORS.inkMuted, marginTop: 2 },
    rowLabel: { ...FONTS.caption },
    rowAmount: { ...FONTS.amountInline, fontSize: 15 },
    emptyText: { ...FONTS.body3, color: COLORS.inkMuted, textAlign: "center", marginTop: SIZES.padding },
    addBtn: {
      position: "absolute",
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: COLORS.primary,
      borderRadius: 24,
      paddingHorizontal: 20,
      paddingVertical: 12,
      elevation: 3,
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    addBtnText: { ...FONTS.h4, color: COLORS.white },
  });

export default GroupDetailScreen;

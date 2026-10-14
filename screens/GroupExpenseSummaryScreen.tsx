import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { Icon } from "react-native-elements";
import { FONTS, SIZES } from "../constants";
import { ColorPalette } from "../constants/theme";
import { useTheme } from "../contexts/ThemeContext";
import { useExpensifyStore } from "../store/store";
import {
  applyBalanceDeltas,
  balanceImpactByFriend,
  deleteSplit,
  fetchSplitSummary,
  updateUserBalances,
} from "../services/Splits";
import { fetchGroupDetail } from "../services/Groups";
import { syncSplitsNow } from "../services/BackgroundSync";
import { ensureTransactionsLoadedFrom } from "../services/TransactionWindow";
import { formatAmountWithCommas } from "../services/Utils";
import { Avatar } from "../components/primitives";

interface Item {
  user_id: string;
  amount_cents: number;
  paid_cents: number;
  owed_cents: number;
}

const fmt = (cents: number) => `₹${formatAmountWithCommas(Math.abs(cents) / 100, true)}`;

const GroupExpenseSummaryScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const navigation: any = useNavigation();
  const route = useRoute<any>();
  const { entryId } = route.params as { entryId: string; grpId?: string };

  const me = useExpensifyStore((s) => s.getUserId());
  const transactionsById = useExpensifyStore((s) => s.transactions);
  const categoriesById = useExpensifyStore((s) => s.categories);
  const userBalancesById = useExpensifyStore((s) => s.userbalances);
  const setUserBalancesInUI = useExpensifyStore((s) => s.setUserBalances);

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [grpId, setGrpId] = useState<string | null>(route.params?.grpId ?? null);
  const [groupName, setGroupName] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});

  const load = async () => {
    const res = await fetchSplitSummary(entryId);
    setSummary(res);
    const gid = res.grp_id ?? grpId;
    setGrpId(gid);
    const n: Record<string, string> = {};
    Object.values(userBalancesById).forEach((b) => (n[b.id] = b.name));
    if (gid) {
      try {
        const d = await fetchGroupDetail(gid, me);
        setGroupName(d.group.name);
        d.members.forEach((m) => {
          if (m.user_name) n[m.user_id] = m.user_name;
        });
      } catch {
        // group not synced yet — fall back to balance names
      }
    }
    setNames(n);
    if (res.transaction_id && res.created_at) {
      await ensureTransactionsLoadedFrom(new Date(res.created_at));
    }
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [entryId]),
  );

  if (loading || !summary) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  const items: Item[] = (summary.items ?? []).filter(
    (i: Item) => i.paid_cents !== 0 || i.owed_cents !== 0,
  );
  const nameOf = (id: string) => (id === me ? "You" : names[id] || "Someone");
  const myItem = items.find((i) => i.user_id === me);
  const myNet = myItem ? myItem.paid_cents - myItem.owed_cents : 0;
  const isPayment = summary.kind === "PAYMENT";
  const canEdit = !isPayment && !!grpId;

  const txn = summary.transaction_id ? transactionsById[String(summary.transaction_id)] : null;
  const category = txn ? categoriesById[String(txn.subcategory_id || txn.category_id)] : null;

  const headlineColor = myNet > 0 ? COLORS.deltaDown : myNet < 0 ? COLORS.deltaUp : COLORS.neutral;
  const headline = !myItem
    ? "You're not part of this expense"
    : myNet > 0
      ? `You lent ${fmt(myNet)}`
      : myNet < 0
        ? `You borrowed ${fmt(myNet)}`
        : "You paid your share";

  const handleDelete = () => {
    Alert.alert("Delete expense", "Delete this expense for everyone in the group?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteSplit(entryId);
            const impact = balanceImpactByFriend(summary.items ?? [], me);
            const deltas: Record<string, number> = {};
            Object.entries(impact).forEach(([id, v]) => (deltas[id] = -v));
            const balances = applyBalanceDeltas(userBalancesById, deltas, names);
            await updateUserBalances(balances);
            setUserBalancesInUI(balances);
            syncSplitsNow().catch(() => {});
            navigation.goBack();
          } catch (e) {
            console.log("Delete group expense error:", e);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="arrow-left" type="material-community" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {canEdit && (
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => navigation.navigate("AddGroupExpense", { grpId, entryId })}
            >
              <Icon name="pencil-outline" type="material-community" size={22} color={COLORS.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.headerBtn} onPress={handleDelete}>
            <Icon name="trash-can-outline" type="material-community" size={22} color={COLORS.red2} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: SIZES.padding, paddingBottom: 60 }}>
        <Text style={styles.title}>{summary.description || (isPayment ? "Payment" : "Expense")}</Text>
        <Text style={styles.subtitle}>
          {[
            groupName ? `in ${groupName}` : null,
            summary.created_at
              ? new Date(summary.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : null,
            category?.name,
          ]
            .filter(Boolean)
            .join("  ·  ")}
        </Text>
        <Text style={styles.total}>{fmt(summary.total_cents ?? 0)}</Text>
        <Text style={[styles.headline, { color: headlineColor }]}>{headline}</Text>

        <View style={styles.card}>
          {items.map((i, idx) => {
            const n = nameOf(i.user_id);
            const parts: string[] = [];
            if (i.paid_cents > 0) parts.push(`paid ${fmt(i.paid_cents)}`);
            if (i.owed_cents > 0) parts.push(`share ${fmt(i.owed_cents)}`);
            return (
              <View key={i.user_id}>
                {idx > 0 && <View style={styles.divider} />}
                <View style={styles.itemRow}>
                  <Avatar name={n} size={32} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{n}</Text>
                    <Text style={styles.itemSub}>{parts.join("  ·  ")}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {txn && (
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate("TransactionEdit", { transaction: txn, mode: "edit" })}
          >
            <Icon name="link-variant" type="material-community" size={18} color={COLORS.primary} />
            <Text style={styles.linkText}>Linked transaction · {fmt(Math.round(txn.amount * 100))}</Text>
            <Icon name="chevron-right" type="material-community" size={18} color={COLORS.gray} />
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.white },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: SIZES.padding,
      paddingTop: SIZES.padding * 2.5,
      paddingBottom: SIZES.base,
    },
    headerBtn: { padding: 6 },
    title: { ...FONTS.h2, color: COLORS.ink, marginTop: SIZES.base },
    subtitle: { ...FONTS.body4, color: COLORS.inkMuted, marginTop: 4 },
    total: { ...FONTS.amountInline, fontSize: 32, color: COLORS.ink, marginTop: SIZES.padding },
    headline: { ...FONTS.body3, fontWeight: "600", marginTop: 4, marginBottom: SIZES.padding },
    card: { backgroundColor: COLORS.lightGray, borderRadius: 14, overflow: "hidden" },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: COLORS.gray,
      marginHorizontal: SIZES.padding * 0.7,
      opacity: 0.3,
    },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: SIZES.padding * 0.7,
      paddingVertical: SIZES.base + 4,
    },
    itemName: { ...FONTS.body3, color: COLORS.primary, fontWeight: "500" },
    itemSub: { ...FONTS.caption, color: COLORS.inkMuted, marginTop: 2 },
    linkRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SIZES.base,
      marginTop: SIZES.padding,
      paddingVertical: SIZES.base + 2,
    },
    linkText: { ...FONTS.body3, color: COLORS.primary, flex: 1 },
  });

export default GroupExpenseSummaryScreen;

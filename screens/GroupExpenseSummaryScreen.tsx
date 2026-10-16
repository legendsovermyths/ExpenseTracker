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
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { listAttachments } from "../services/Attachments";
import { Attachment, DOC_TYPE_LABELS } from "../types/entity/Attachment";
import { Surface, GlyphPlate } from "../components/primitives";
import SplitBreakdownCard from "../components/SplitBreakdownCard";

interface Item {
  user_id: string;
  amount_cents: number;
  paid_cents: number;
  owed_cents: number;
}

const fmt = (cents: number) => `₹${formatAmountWithCommas(Math.abs(cents) / 100, true)}`;

const colorForId = (id: number, palette: readonly string[]): string =>
  palette[Math.abs(id) % palette.length];

const GroupExpenseSummaryScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const navigation: any = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { entryId } = route.params as { entryId: string; grpId?: string };

  const me = useExpensifyStore((s) => s.getUserId());
  const transactionsById = useExpensifyStore((s) => s.transactions);
  const categoriesById = useExpensifyStore((s) => s.categories);
  const accountsById = useExpensifyStore((s) => s.accounts);
  const userBalancesById = useExpensifyStore((s) => s.userbalances);
  const setUserBalancesInUI = useExpensifyStore((s) => s.setUserBalances);

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [grpId, setGrpId] = useState<string | null>(route.params?.grpId ?? null);
  const [groupName, setGroupName] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Attachment[]>([]);

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
      listAttachments("SPLIT", entryId)
        .then(setFiles)
        .catch(() => setFiles([]));
    }, [entryId]),
  );

  if (loading || !summary) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  const items: Item[] = (summary.items ?? []).filter(
    (i: Item) => i.paid_cents !== 0 || i.owed_cents !== 0,
  );
  const nameOf = (id: string) => (id === me ? "You" : names[id] || "Someone");
  const myItem = items.find((i) => i.user_id === me);
  const myPaid = myItem?.paid_cents ?? 0;
  const myOwe = myItem?.owed_cents ?? 0;
  const myNet = myPaid - myOwe;
  const isPayment = summary.kind === "PAYMENT";
  const canEdit = !isPayment && !!grpId;
  const totalCents: number =
    summary.total_cents ?? items.reduce((s, i) => s + i.paid_cents, 0);

  const txn = summary.transaction_id ? transactionsById[String(summary.transaction_id)] : null;
  const category = txn ? categoriesById[String(txn.subcategory_id || txn.category_id)] : null;
  const linkedAccount = txn ? accountsById[String(txn.account_id)] : null;
  const glyphColor = category
    ? colorForId(txn!.subcategory_id || txn!.category_id || 0, COLORS.ordinal)
    : COLORS.accent;

  const dateLabel = summary.created_at
    ? new Date(summary.created_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;
  const subtitleParts = [groupName ? `in ${groupName}` : null, dateLabel, category?.name].filter(
    Boolean,
  );

  // You first, then everyone else in the order the server returned them.
  const people = [...items]
    .sort((a, b) => (a.user_id === me ? -1 : b.user_id === me ? 1 : 0))
    .map((i) => ({
      id: i.user_id,
      name: nameOf(i.user_id),
      paidCents: i.paid_cents,
      oweCents: i.owed_cents,
    }));

  let headlineLabel: string;
  let headlineColor: string;
  let headlineAmount: number | null;
  if (isPayment) {
    const payer = items.find((i) => i.paid_cents > 0);
    headlineLabel = payer ? `${nameOf(payer.user_id)} paid` : "Payment";
    headlineColor = COLORS.inkMuted;
    headlineAmount = totalCents;
  } else if (!myItem) {
    headlineLabel = "You're not part of this expense";
    headlineColor = COLORS.neutral;
    headlineAmount = null;
  } else if (myNet > 0) {
    headlineLabel = "You lent";
    headlineColor = COLORS.deltaDown;
    headlineAmount = myNet;
  } else if (myNet < 0) {
    headlineLabel = "You borrowed";
    headlineColor = COLORS.deltaUp;
    headlineAmount = myNet;
  } else {
    headlineLabel = "You paid your share";
    headlineColor = COLORS.neutral;
    headlineAmount = null;
  }

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

  const goToTransaction = () => {
    if (txn) {
      navigation.navigate("TransactionEdit", { transaction: txn, mode: "edit" });
    } else {
      navigation.navigate("TransactionEdit", {
        transaction: {
          description: summary.description,
          amount: myOwe / 100,
          date_time: summary.created_at || new Date().toISOString(),
        },
        mode: "add",
        entryId,
      });
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + SIZES.base }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="arrow-left" type="material-community" size={24} color={COLORS.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Hero */}
        <View style={styles.hero}>
          <GlyphPlate
            name={category ? category.icon_name : isPayment ? "cash-fast" : "account-group"}
            type={category ? category.icon_type : "material-community"}
            color={glyphColor}
            size={64}
            radius={20}
          />
          <Text style={styles.heroTitle}>
            {summary.description || (isPayment ? "Payment" : "Expense")}
          </Text>
          {subtitleParts.length > 0 && (
            <Text style={styles.heroSubtitle}>{subtitleParts.join("  ·  ")}</Text>
          )}
        </View>

        {/* Settlement headline */}
        <View style={styles.settlement}>
          <Text style={styles.settlementLabel}>{headlineLabel}</Text>
          {headlineAmount != null && (
            <Text style={[styles.settlementAmount, { color: headlineColor }]}>
              {fmt(headlineAmount)}
            </Text>
          )}
          {!isPayment && (
            <Text style={styles.settlementTotal}>
              of {fmt(totalCents)} total · {people.length} people
            </Text>
          )}
        </View>

        <SplitBreakdownCard people={people} showBar={!isPayment} />

        {/* Linked expense */}
        {!isPayment && myOwe > 0 && (
          <TouchableOpacity activeOpacity={0.75} onPress={goToTransaction}>
            <Surface tier={1} style={styles.linkRow} bordered={false}>
              <Icon
                name={txn ? "receipt" : "plus-circle-outline"}
                type="material-community"
                size={22}
                color={txn ? COLORS.accent : COLORS.inkMuted}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.linkTitle}>{txn ? "Logged as expense" : "Add as expense"}</Text>
                {txn && (
                  <Text style={styles.linkSub}>
                    {linkedAccount?.name ?? "Account"}  ·  {fmt(Math.round(txn.amount * 100))}
                  </Text>
                )}
              </View>
              <Icon name="chevron-right" type="material-community" size={20} color={COLORS.inkSubtle} />
            </Surface>
          </TouchableOpacity>
        )}

        {/* Attached files */}
        {files.length > 0 && (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => navigation.navigate("AttachmentViewer", { attachments: files, index: 0 })}
          >
            <Surface tier={1} style={styles.linkRow} bordered={false}>
              <Icon name="paperclip" type="material-community" size={22} color={COLORS.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.linkTitle}>
                  {files.length} {files.length === 1 ? "file" : "files"} attached
                </Text>
                <Text style={styles.linkSub} numberOfLines={1}>
                  {Array.from(
                    new Set(files.map((f) => (f.doc_type ? DOC_TYPE_LABELS[f.doc_type] : "Unsorted"))),
                  ).join("  ·  ")}
                </Text>
              </View>
              <Icon name="chevron-right" type="material-community" size={20} color={COLORS.inkSubtle} />
            </Surface>
          </TouchableOpacity>
        )}

        {/* Actions */}
        {canEdit && (
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate("AddGroupExpense", { grpId, entryId })}
            activeOpacity={0.85}
          >
            <Icon name="pencil" type="material-community" size={18} color={COLORS.paper} />
            <Text style={styles.editBtnText}>Edit expense</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.7}>
          <Icon name="delete-outline" type="material-community" size={18} color={COLORS.deltaUp} />
          <Text style={styles.deleteBtnText}>Delete expense</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.paper },
    centered: { justifyContent: "center", alignItems: "center" },

    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: SIZES.padding,
      paddingBottom: SIZES.base,
    },
    headerBtn: { padding: 4 },

    content: { paddingHorizontal: SIZES.padding },

    hero: { alignItems: "center", marginTop: SIZES.base },
    heroTitle: {
      ...FONTS.screenTitle,
      color: COLORS.ink,
      textAlign: "center",
      marginTop: SIZES.base + 4,
    },
    heroSubtitle: {
      ...FONTS.bodyS,
      color: COLORS.inkMuted,
      marginTop: 4,
      textAlign: "center",
    },

    settlement: {
      alignItems: "center",
      marginTop: SIZES.padding,
      marginBottom: SIZES.padding,
    },
    settlementLabel: { ...FONTS.bodyM, color: COLORS.inkMuted, marginBottom: 6 },
    settlementAmount: { ...FONTS.amountHero },
    settlementTotal: { ...FONTS.bodyS, color: COLORS.inkSubtle, marginTop: 6 },

    linkRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SIZES.base + 2,
      paddingHorizontal: SIZES.padding * 0.7,
      paddingVertical: SIZES.base + 4,
      marginBottom: SIZES.padding,
    },
    linkTitle: { ...FONTS.bodyM, fontFamily: "Roboto-Bold", color: COLORS.ink },
    linkSub: { ...FONTS.caption, color: COLORS.inkMuted, marginTop: 2 },

    editBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: COLORS.accent,
      borderRadius: SIZES.radius,
      paddingVertical: 15,
    },
    editBtnText: { ...FONTS.h4, color: COLORS.paper },
    deleteBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 14,
      marginTop: SIZES.base,
    },
    deleteBtnText: { ...FONTS.body3, color: COLORS.deltaUp, fontFamily: "Roboto-Bold" },
  });

export default GroupExpenseSummaryScreen;

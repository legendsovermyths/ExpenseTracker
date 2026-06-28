import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRoute, useNavigation, useFocusEffect } from "@react-navigation/native";
import { Icon } from "react-native-elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONTS, SIZES } from "../constants";
import { ColorPalette } from "../constants/theme";
import { useExpensifyStore } from "../store/store";
import { Transaction } from "../types/entity/Transaction";
import {
  deleteSplit,
  updateUserBalances,
  fetchSplitSummary,
} from "../services/Splits";
import { formatAmountWithCommas } from "../services/Utils";
import { useTheme } from "../contexts/ThemeContext";
import { Surface, GlyphPlate, Avatar, avatarColor } from "../components/primitives";

interface Params {
  entryId: string;
  friendId: string;
  friendName: string;
}

interface LineItemInfo {
  user_id: string;
  amount_cents: number;
  paid_cents: number;
  owed_cents: number;
}

const colorForId = (id: number, palette: readonly string[]): string =>
  palette[Math.abs(id) % palette.length];

const fmt = (cents: number) => `₹${formatAmountWithCommas(cents / 100, true)}`;

const SplitSummaryScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const navigation: any = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { entryId, friendName, friendId } = route.params as Params;

  const meId = useExpensifyStore((state) => state.getUserId());
  const transactionsById = useExpensifyStore((state) => state.transactions);
  const categoriesById = useExpensifyStore((state) => state.categories);
  const accountsById = useExpensifyStore((state) => state.accounts);
  const userBalancesById = useExpensifyStore((state) => state.userbalances);
  const setUserBalancesInUI = useExpensifyStore((state) => state.setUserBalances);

  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState<string>("Split");
  const [items, setItems] = useState<LineItemInfo[]>([]);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [kind, setKind] = useState<string>("SPLIT");
  const [transactionId, setTransactionId] = useState<number | null>(null);

  const load = async () => {
    const res = await fetchSplitSummary(entryId);
    setDescription(res.description || "Split");
    setItems(res.items as LineItemInfo[]);
    setCreatedAt(res.created_at ?? null);
    setKind(res.kind ?? "SPLIT");
    setTransactionId(res.transaction_id ?? null);
    setLoading(false);
  };

  // Resolve the linked transaction from the live store during render so it
  // reflects a just-added expense the moment we refocus this screen.
  const transaction: Transaction | null =
    transactionId != null ? transactionsById[String(transactionId)] ?? null : null;

  useFocusEffect(
    useCallback(() => {
      load();
    }, [entryId]),
  );

  // ── derived ────────────────────────────────────────────────────────
  const meItem = items.find((i) => i.user_id === meId);
  const friendItem = items.find((i) => i.user_id === friendId);

  const myPaid = meItem?.paid_cents ?? 0;
  const myOwe = meItem?.owed_cents ?? 0;
  const friendPaid = friendItem?.paid_cents ?? 0;
  const friendOwe = friendItem?.owed_cents ?? 0;
  const totalCents = myPaid + friendPaid;

  // my net for this entry: +ve → friend owes me, -ve → I owe friend
  const myNet = myPaid - myOwe;
  const isPayment = kind === "PAYMENT";

  // category / icon from the linked transaction, else a split glyph
  const linkedCategory = transaction
    ? categoriesById[String(transaction.subcategory_id || transaction.category_id)]
    : null;
  const linkedAccount = transaction
    ? accountsById[String(transaction.account_id)]
    : null;
  const glyphColor = linkedCategory
    ? colorForId(
        transaction!.subcategory_id || transaction!.category_id || 0,
        COLORS.ordinal,
      )
    : COLORS.accent;

  const dateLabel = createdAt
    ? new Date(createdAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";
  const subtitleParts = [dateLabel, linkedCategory?.name].filter(Boolean);

  // settlement headline
  let headlineLabel: string;
  let headlineColor: string;
  if (isPayment) {
    headlineLabel = myPaid > 0 ? `You paid ${friendName}` : `${friendName} paid you`;
    headlineColor = COLORS.inkMuted;
  } else if (myNet > 0) {
    headlineLabel = `${friendName} owes you`;
    headlineColor = COLORS.deltaDown;
  } else if (myNet < 0) {
    headlineLabel = `You owe ${friendName}`;
    headlineColor = COLORS.deltaUp;
  } else {
    headlineLabel = "All settled";
    headlineColor = COLORS.neutral;
  }
  const headlineAmount = isPayment ? totalCents : Math.abs(myNet);

  // split bar (owed proportions)
  const totalOwe = myOwe + friendOwe;
  const myOweFrac = totalOwe > 0 ? myOwe / totalOwe : 0.5;
  const friendOweFrac = 1 - myOweFrac;
  const youColor = avatarColor("You");
  const friendColor = avatarColor(friendName);

  // ── delete ─────────────────────────────────────────────────────────
  const handleDelete = () => {
    Alert.alert("Delete split", "Are you sure you want to delete this split?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteSplit(entryId);
            // reverse the friend's balance using the items we already have
            const balances = { ...userBalancesById };
            items.forEach((item) => {
              if (item.user_id !== meId && balances[item.user_id]) {
                const impact = item.owed_cents - item.paid_cents;
                balances[item.user_id] = {
                  ...balances[item.user_id],
                  net_cents: balances[item.user_id].net_cents - impact,
                };
              }
            });
            await updateUserBalances(Object.values(balances));
            setUserBalancesInUI(Object.values(balances));
            navigation.goBack();
          } catch (e) {
            console.log("Delete split error:", e);
          }
        },
      },
    ]);
  };

  const handleEdit = () => {
    navigation.navigate("SplitInputScreen", {
      mode: "edit",
      entryId,
      userId: friendId,
      userName: friendName,
    });
  };

  const goToTransaction = () => {
    if (transaction) {
      navigation.navigate("TransactionEdit", { transaction, mode: "edit" });
    } else {
      navigation.navigate("TransactionEdit", {
        transaction: {
          description,
          amount: myOwe / 100,
          date_time: createdAt || new Date().toISOString(),
        },
        mode: "add",
        entryId,
      });
    }
  };

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SIZES.base }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="arrow-left" type="material-community" size={24} color={COLORS.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <GlyphPlate
            name={linkedCategory ? linkedCategory.icon_name : "call-split"}
            type={linkedCategory ? linkedCategory.icon_type : "material-community"}
            color={glyphColor}
            size={64}
            radius={20}
          />
          <Text style={styles.heroTitle}>{description}</Text>
          {subtitleParts.length > 0 && (
            <Text style={styles.heroSubtitle}>{subtitleParts.join("  ·  ")}</Text>
          )}
        </View>

        {/* Settlement headline */}
        <View style={styles.settlement}>
          <Text style={styles.settlementLabel}>{headlineLabel}</Text>
          {!(headlineLabel === "All settled") && (
            <Text style={[styles.settlementAmount, { color: headlineColor }]}>
              {fmt(headlineAmount)}
            </Text>
          )}
        </View>

        {/* Breakdown */}
        <Surface tier={2} style={styles.card} padding={0}>
          {/* column headers */}
          <View style={[styles.breakdownRow, styles.breakdownHead]}>
            <View style={{ flex: 1 }} />
            <Text style={styles.colHead}>PAID</Text>
            <Text style={styles.colHead}>OWE</Text>
          </View>

          <PersonRow
            name="You"
            paid={myPaid}
            owe={myOwe}
            styles={styles}
          />
          <View style={styles.divider} />
          <PersonRow
            name={friendName}
            paid={friendPaid}
            owe={friendOwe}
            styles={styles}
          />

          {!isPayment && totalOwe > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.barSection}>
                <View style={styles.bar}>
                  <View
                    style={{
                      flex: Math.max(myOweFrac, 0.001),
                      backgroundColor: youColor,
                    }}
                  />
                  <View
                    style={{
                      flex: Math.max(friendOweFrac, 0.001),
                      backgroundColor: friendColor,
                    }}
                  />
                </View>
                <View style={styles.barLegend}>
                  <Text style={styles.barLegendText}>
                    You {Math.round(myOweFrac * 100)}%
                  </Text>
                  <Text style={styles.barLegendText}>
                    {friendName} {Math.round(friendOweFrac * 100)}%
                  </Text>
                </View>
              </View>
            </>
          )}
        </Surface>

        {/* Linked expense */}
        {!isPayment && (
          <TouchableOpacity activeOpacity={0.75} onPress={goToTransaction}>
            <Surface tier={1} style={styles.linkRow} bordered={false}>
              <Icon
                name={transaction ? "receipt" : "plus-circle-outline"}
                type="material-community"
                size={22}
                color={transaction ? COLORS.accent : COLORS.inkMuted}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.linkTitle}>
                  {transaction ? "Logged as expense" : "Add as expense"}
                </Text>
                {transaction && (
                  <Text style={styles.linkSub}>
                    {linkedAccount?.name ?? "Account"}  ·  {fmt(myOwe)}
                  </Text>
                )}
              </View>
              <Icon name="chevron-right" type="material-community" size={20} color={COLORS.inkSubtle} />
            </Surface>
          </TouchableOpacity>
        )}

        {/* Actions */}
        <TouchableOpacity style={styles.editBtn} onPress={handleEdit} activeOpacity={0.85}>
          <Icon name="pencil" type="material-community" size={18} color={COLORS.paper} />
          <Text style={styles.editBtnText}>Edit split</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.7}>
          <Icon name="delete-outline" type="material-community" size={18} color={COLORS.deltaUp} />
          <Text style={styles.deleteBtnText}>Delete split</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const PersonRow: React.FC<{
  name: string;
  paid: number;
  owe: number;
  styles: ReturnType<typeof createStyles>;
}> = ({ name, paid, owe, styles }) => (
  <View style={styles.breakdownRow}>
    <Avatar name={name} size={32} />
    <Text style={styles.personName} numberOfLines={1}>
      {name}
    </Text>
    <Text style={styles.colValue}>{fmt(paid)}</Text>
    <Text style={styles.colValue}>{fmt(owe)}</Text>
  </View>
);

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

    // Hero
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
    },

    // Settlement
    settlement: {
      alignItems: "center",
      marginTop: SIZES.padding,
      marginBottom: SIZES.padding,
    },
    settlementLabel: {
      ...FONTS.bodyM,
      color: COLORS.inkMuted,
      marginBottom: 6,
    },
    settlementAmount: {
      ...FONTS.amountHero,
    },

    // Breakdown card
    card: { marginBottom: SIZES.base + 4, overflow: "hidden" },
    breakdownRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: SIZES.padding * 0.7,
      paddingVertical: SIZES.base + 4,
      gap: SIZES.base + 2,
    },
    breakdownHead: {
      paddingBottom: 2,
      paddingTop: SIZES.base + 2,
    },
    colHead: {
      ...FONTS.caption,
      color: COLORS.inkSubtle,
      letterSpacing: 1,
      width: 78,
      textAlign: "right",
    },
    personName: {
      ...FONTS.bodyM,
      fontFamily: "Roboto-Bold",
      color: COLORS.ink,
      flex: 1,
    },
    colValue: {
      ...FONTS.amountInline,
      fontSize: 15,
      color: COLORS.ink,
      width: 78,
      textAlign: "right",
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: COLORS.hairline,
      marginHorizontal: SIZES.padding * 0.7,
    },

    // Split bar
    barSection: {
      paddingHorizontal: SIZES.padding * 0.7,
      paddingVertical: SIZES.base + 4,
    },
    bar: {
      flexDirection: "row",
      height: 8,
      borderRadius: 4,
      overflow: "hidden",
    },
    barLegend: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 8,
    },
    barLegendText: { ...FONTS.caption, color: COLORS.inkMuted },

    // Linked expense
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

    // Actions
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

export default SplitSummaryScreen;

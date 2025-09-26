import React, { useCallback, useState } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
} from "react-native";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { Button, Provider } from "react-native-paper";
import { Icon } from "react-native-elements";
import { COLORS, FONTS, SIZES } from "../constants";
import HeaderText from "../components/HeaderText";
import { fetchFriendLedger } from "../services/Splits";
import { useExpensifyStore } from "../store/store";
import { Transaction } from "../types/entity/Transaction";
import { Category } from "../types/entity/Category";

interface LedgerItemRow {
  is_dirty: boolean;
  entry_id: string;
  description: string | null;
  created_at: string;
  delta_cents: number;
  transaction_id: number;
  kind: "SPLIT" | "PAYMENT";
}

const iconPool = [
  "coffee",
  "shopping-bag",
  "film",
  "gift",
  "heart",
  "book",
  "sun",
];
const pickIcon = (id: string) => iconPool[id.charCodeAt(0) % iconPool.length];

const LedgerCard: React.FC<{
  item: LedgerItemRow;
  friendName: string;
  friendId: string;
}> = ({ item, friendName, friendId }) => {
  const positive = item.delta_cents > 0;
  const amountRs = Math.abs(item.delta_cents) / 100;
  const navigation: any = useNavigation();
  const transaction: Transaction = item.transaction_id
    ? useExpensifyStore((store) =>
        store.getTransactionById(item.transaction_id),
      )
    : null;
  const category: Category = item.transaction_id
    ? transaction.subcategory_id
      ? useExpensifyStore((store) =>
          store.getCategoryById(transaction.subcategory_id),
        )
      : useExpensifyStore((store) =>
          store.getCategoryById(transaction.category_id),
        )
    : null;
  if (item.kind === "PAYMENT") {
    return (
      <View style={[styles.cardRow, { justifyContent: "center" }]}>
        <Text
          style={[
            styles.descText,
            { color: COLORS.darkgray, textAlign: "center" },
          ]}
        >
          {" "}
          {!positive ? `${friendName} ➜ You` : `You ➜ ${friendName}`}{" "}
        </Text>
        <Text
          style={[
            styles.amountText,
            { color: COLORS.darkgray, marginLeft: 6, fontSize: 18 },
          ]}
        >
          ₹{amountRs.toFixed(2)}
        </Text>
      </View>
    );
  }

  const iconName = pickIcon(item.entry_id);
  return (
    <TouchableOpacity
      onPress={() =>
        navigation.navigate("SplitSummary", {
          entryId: item.entry_id,
          friendName,
          friendId,
        })
      }
    >
      <View style={styles.cardRow}>
        <View style={styles.iconContainer}>
          <Icon
            name={
              item.is_dirty
                ? "hourglass-half"
                : category
                  ? category.icon_name
                  : iconName
            }
            type={
              item.is_dirty
                ? "font-awesome"
                : category
                  ? category.icon_type
                  : "feather"
            }
            size={20}
            color={COLORS.white}
          />
        </View>
        <View style={{ flex: 1, marginLeft: SIZES.padding / 3 }}>
          <Text style={styles.descText}>
            {item.description || "(No description)"}
          </Text>
          <Text style={styles.dateText}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text
            style={{
              ...FONTS.body4,
              color: positive ? COLORS.darkgreen : COLORS.red2,
              marginBottom: 2,
            }}
          >
            {positive ? "You lent" : "You borrowed"}
          </Text>
          <Text
            style={{
              ...FONTS.body2,
              color: positive ? COLORS.darkgreen : COLORS.red2,
            }}
          >
            ₹{amountRs.toFixed(2)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const FriendLedgerScreen: React.FC = () => {
  const route = useRoute<any>();
  const {
    friendId,
    friendName,
    netCents: cents,
  } = route.params as {
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

  const navigation: any = useNavigation();
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
      let cents = finalRows.reduce((acc, row) => acc + row.delta_cents, 0);
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
  let visibleRows = rows;
  let hasHidden = false;
  if (!showSettled) {
    let running = 0;
    visibleRows = [];
    for (const r of rows) {
      running += r.delta_cents;
      visibleRows.push(r);
      if (running === netCents) {
        hasHidden = rows.length > visibleRows.length;
        break;
      }
    }
  }
  if (netCents <= 1 && netCents >= -1 && !showSettled) {
    visibleRows = [];
  }
  const handleAddSplit = () => {
    navigation.navigate("SplitInputScreen", {
      userId: friendId,
      userName: friendName,
    });
  };
  const handleSettle = async () => {
    const meId = userId;
    navigation.navigate("SettleScreen", {
      payerId: overallPositive ? friendId : meId, // friend pays if they owe you
      payerName: overallPositive ? friendName : "You",
      payeeId: overallPositive ? meId : friendId,
      payeeName: overallPositive ? "You" : friendName,
      amountCents: Math.abs(netCents),
    });
  };
  const isZero = netCents <= 1 && netCents >= -1;
  const overallPositive = netCents > 0;
  const overallRs = Math.abs(netCents) / 100;
  const overallLabel = isZero
    ? "All settled up!"
    : overallPositive
      ? "Overall you are owed "
      : "Overall you owe ";
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: COLORS.red }}>{error}</Text>
        <Button mode="outlined" onPress={fetchLedger}>
          Retry
        </Button>
      </View>
    );
  }

  return (
    <Provider>
      <View style={styles.screenWrapper}>
        <View style={styles.screenWrapper}>
          <View
            style={[
              styles.headerBar,
              { flexDirection: "row", alignItems: "center" },
            ]}
          >
            <HeaderText text={friendName} />
          </View>
          <Text
            style={[
              styles.overallText,
              {
                color: isZero
                  ? COLORS.darkgray
                  : overallPositive
                    ? COLORS.darkgreen
                    : COLORS.red2,
              },
            ]}
          >
            {overallLabel} {isZero ? "" : "₹" + overallRs.toFixed(2)}
          </Text>
          <View style={styles.buttonsRow}>
            <Button
              mode="outlined"
              textColor={COLORS.primary}
              style={[
                styles.actionButton,
                { borderWidth: 1, borderColor: COLORS.primary },
              ]}
              labelStyle={{
                ...FONTS.body4,
                textTransform: "capitalize",
                color: COLORS.primary,
              }}
              onPress={handleSettle}
            >
              Settle
            </Button>

            <Button
              mode="contained"
              buttonColor={COLORS.primary}
              style={styles.actionButton}
              labelStyle={{
                ...FONTS.body4,
                textTransform: "capitalize",
                color: COLORS.white,
              }}
              onPress={handleAddSplit}
            >
              Add Split
            </Button>
          </View>
          <FlatList
            showsVerticalScrollIndicator={false}
            data={visibleRows}
            keyExtractor={(item) => item.entry_id}
            renderItem={({ item }) => (
              <LedgerCard
                item={item}
                friendName={friendName}
                friendId={friendId}
              />
            )}
            contentContainerStyle={{
              paddingHorizontal: SIZES.padding,
              paddingBottom: SIZES.padding,
            }}
            ListEmptyComponent={() => (
              <Text
                style={{
                  textAlign: "center",
                  marginTop: 20,
                  color: COLORS.darkgray,
                }}
              >
                All settled up!
              </Text>
            )}
            ListFooterComponent={
              !showSettled && (
                <TouchableOpacity
                  onPress={() => setShowSettled(true)}
                  style={styles.showSettledBtn}
                >
                  <Text style={styles.showSettledText}>
                    Show settled transactions
                  </Text>
                </TouchableOpacity>
              )
            }
          />
        </View>
      </View>
    </Provider>
  );
};

// ---------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------
const styles = StyleSheet.create({
  iconContainer: {
    backgroundColor: COLORS.lightBlue,
    height: 40,
    width: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  screenWrapper: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingTop: SIZES.padding,
  },
  headerBar: {
    paddingHorizontal: SIZES.padding,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SIZES.padding / 4,
  },
  buttonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: SIZES.padding,
    marginBottom: SIZES.padding / 2,
  },
  actionButton: { flex: 1, marginHorizontal: 4, borderRadius: 20 },
  buttonLabel: { ...FONTS.body4, textTransform: "capitalize" },
  descText: {
    ...FONTS.body3,
    color: COLORS.primary,
  },
  dateText: {
    ...FONTS.caption,
    color: COLORS.darkgray,
  },
  amountText: { ...FONTS.body2 },
  overallText: {
    ...FONTS.body3,
    marginLeft: (5 * SIZES.padding) / 4,
    textAlign: "left",
    marginBottom: SIZES.padding,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.white,
  },
  showSettledBtn: { alignSelf: "center", marginVertical: 6 },
  showSettledText: { ...FONTS.body4, color: COLORS.darkgray },
});

export default FriendLedgerScreen;

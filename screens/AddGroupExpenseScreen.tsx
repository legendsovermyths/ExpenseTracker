import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Icon } from "react-native-elements";
import { Provider } from "react-native-paper";
import DateTimePicker from "@react-native-community/datetimepicker";
import uuid from "react-native-uuid";
import { evaluate } from "mathjs";
import { FONTS, SIZES, FONT } from "../constants";
import { ColorPalette } from "../constants/theme";
import { useTheme } from "../contexts/ThemeContext";
import { useExpensifyStore } from "../store/store";
import { CustomKeyboard, useCustomKeyboard } from "../components/CustomKeyboard";
import CategoryBottomSheet from "../components/CategoryBottomSheet";
import { Avatar } from "../components/primitives";
import { fetchGroupDetail } from "../services/Groups";
import {
  addSplitData,
  applyBalanceDeltas,
  balanceImpactByFriend,
  fetchSplitSummary,
  linkTransactionToLedgerEntry,
  updateUserBalances,
} from "../services/Splits";
import { addTransaction, updateTransaction } from "../services/TransactionService";
import { ensureTransactionsLoadedFrom } from "../services/TransactionWindow";
import { syncSplitsNow } from "../services/BackgroundSync";
import { formatAmountWithCommas } from "../services/Utils";
import { Account } from "../types/entity/Account";
import { GroupMember } from "../types/entity/Group";
import { LedgerEntryRow } from "../types/entity/LedgerEntryRow";
import { LineItemRow } from "../types/entity/LineItemRow";

type SplitMode = "equal" | "exact";

interface ItemLike {
  user_id: string;
  paid_cents: number;
  owed_cents: number;
}

const toCents = (v: string | number) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? 0 : Math.round(n * 100);
};
// Accepts a plain number or a keyboard expression ("120+45") mid-entry.
const evalCents = (v: string | undefined) => {
  if (!v) return 0;
  try {
    const r = evaluate(v);
    if (typeof r === "number" && isFinite(r)) return Math.round(r * 100);
  } catch {
    // incomplete expression — fall back to its leading number
  }
  return toCents(v);
};
const now = () => new Date().toISOString();
const fmt = (cents: number) => `₹${formatAmountWithCommas(cents / 100, true)}`;

// Equal shares; leftover cents go to the first participants in order so the
// shares always sum to the total exactly.
const equalShares = (totalCents: number, ids: string[]): Record<string, number> => {
  const out: Record<string, number> = {};
  if (ids.length === 0) return out;
  const base = Math.floor(totalCents / ids.length);
  let rem = totalCents - base * ids.length;
  ids.forEach((id) => {
    out[id] = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem--;
  });
  return out;
};

const AddGroupExpenseScreen: React.FC = () => {
  const { COLORS, isDark } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const navigation: any = useNavigation();
  const route = useRoute<any>();
  const { grpId, entryId: editEntryId } = route.params as { grpId: string; entryId?: string };
  const isEdit = !!editEntryId;

  const me = useExpensifyStore((s) => s.getUserId());
  const categoriesById = useExpensifyStore((s) => s.categories);
  const accountsById = useExpensifyStore((s) => s.accounts);
  const categories = Object.values(categoriesById).filter((c) => !c.is_deleted);
  const accounts = Object.values(accountsById).filter((a) => !a.is_deleted);
  const userBalancesById = useExpensifyStore((s) => s.userbalances);
  const setUserBalancesInUI = useExpensifyStore((s) => s.setUserBalances);
  const addTransactionToUI = useExpensifyStore((s) => s.addTransaction);
  const updateTransactionInUI = useExpensifyStore((s) => s.updateTransactions);

  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("0");
  // What the custom keyboard is editing: the total, or one member's exact share.
  const [kbTarget, setKbTarget] = useState<"amount" | string | null>(null);
  const showKeyboard = kbTarget !== null;
  const [payerId, setPayerId] = useState<string>(me);
  const [participants, setParticipants] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<SplitMode>("equal");
  const [exact, setExact] = useState<Record<string, string>>({});
  const [addToTransaction, setAddToTransaction] = useState(false);
  const [selectedBank, setSelectedBank] = useState<Account | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<any>(null);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit-mode state preserved across the save.
  const oldItems = useRef<ItemLike[]>([]);
  const editCreatedAt = useRef<string | null>(null);
  const editTxnId = useRef<number | null>(null);

  const { expression, onKeyPress, evaluateExpression, resetExpression } = useCustomKeyboard("");
  const catSheetRef = useRef<any>(null);
  const scrollRef = useRef<ScrollView>(null);
  const cardY = useRef(0);
  const rowY = useRef<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      try {
        const d = await fetchGroupDetail(grpId, me);
        setGroupName(d.group.name);
        let roster = d.members;

        if (isEdit) {
          const res = await fetchSplitSummary(editEntryId!);
          const items = (res.items ?? []) as ItemLike[];
          oldItems.current = items;
          editCreatedAt.current = res.created_at ?? now();
          editTxnId.current = res.transaction_id ?? null;

          // Someone who has since left the group can still be on this expense.
          const known = new Set(roster.map((m) => m.user_id));
          items
            .filter((i) => !known.has(i.user_id))
            .forEach((i) =>
              roster = [
                ...roster,
                {
                  grp_id: grpId,
                  user_id: i.user_id,
                  user_name: userBalancesById[i.user_id]?.name ?? "Former member",
                  joined_at: "",
                  updated_at: "",
                  is_deleted: true,
                },
              ],
            );

          const total = res.total_cents ?? 0;
          setDescription(res.description ?? "");
          const amtStr = String(total / 100);
          setAmount(amtStr);
          resetExpression(amtStr);
          const payer = items.find((i) => i.paid_cents > 0);
          if (payer) setPayerId(payer.user_id);
          const owing = items.filter((i) => i.owed_cents > 0);
          setParticipants(new Set(owing.map((i) => i.user_id)));
          const eq = equalShares(total, roster.map((m) => m.user_id).filter((id) => owing.some((o) => o.user_id === id)));
          const isEqual = owing.every((i) => Math.abs((eq[i.user_id] ?? 0) - i.owed_cents) <= 1);
          if (!isEqual) {
            setMode("exact");
            const ex: Record<string, string> = {};
            owing.forEach((i) => (ex[i.user_id] = String(i.owed_cents / 100)));
            setExact(ex);
          }

          if (res.transaction_id) {
            if (res.created_at) await ensureTransactionsLoadedFrom(new Date(res.created_at));
            const txn = useExpensifyStore.getState().transactions[String(res.transaction_id)];
            if (txn) {
              setAddToTransaction(true);
              const acc = accountsById[String(txn.account_id)];
              if (acc) setSelectedBank(acc);
              const cat = categoriesById[String(txn.category_id)];
              if (cat) setSelectedCategory(cat);
              if (txn.subcategory_id) {
                const sub = categoriesById[String(txn.subcategory_id)];
                if (sub) setSelectedSubcategory(sub);
              }
              if (txn.date_time) setDate(new Date(txn.date_time));
            }
          }
        } else {
          setParticipants(new Set(roster.map((m) => m.user_id)));
        }
        setMembers(roster);
      } catch (e) {
        setError("Couldn't load the group");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const nameOf = (id: string) =>
    id === me ? "You" : members.find((m) => m.user_id === id)?.user_name || "Someone";

  const totalCents = toCents(amount);
  const orderedParticipants = members.map((m) => m.user_id).filter((id) => participants.has(id));
  const shares: Record<string, number> =
    mode === "equal"
      ? equalShares(totalCents, orderedParticipants)
      : Object.fromEntries(orderedParticipants.map((id) => [id, evalCents(exact[id])]));
  const sharesSum = orderedParticipants.reduce((s, id) => s + (shares[id] ?? 0), 0);
  const myShare = shares[me] ?? 0;

  const commitTarget = () => {
    if (kbTarget === "amount") {
      setAmount(evaluateExpression());
    } else if (kbTarget) {
      const v = evaluateExpression();
      setExact((prev) => ({ ...prev, [kbTarget]: v === "Error" ? "0" : v }));
    }
  };

  const commitKeyboard = () => {
    commitTarget();
    setKbTarget(null);
  };

  const openKeyboard = (target: "amount" | string) => {
    if (kbTarget && kbTarget !== target) commitTarget();
    setShowDatePicker(false);
    setShowAccountPicker(false);
    catSheetRef.current?.close();
    Keyboard.dismiss();
    if (target === "amount") {
      resetExpression(amtFloat > 0 ? amount : "");
    } else {
      resetExpression(evalCents(exact[target]) > 0 ? exact[target] : "");
      // Wait for the keyboard to shrink the scroll view, then bring the row into view.
      setTimeout(() => {
        const y = cardY.current + (rowY.current[target] ?? 0);
        scrollRef.current?.scrollTo({ y: Math.max(0, y - SIZES.padding * 2), animated: true });
      }, 80);
    }
    setKbTarget(target);
  };

  const dismissAll = () => {
    commitKeyboard();
    setShowDatePicker(false);
    setShowAccountPicker(false);
    catSheetRef.current?.close();
    Keyboard.dismiss();
  };

  const toggleParticipant = (id: string) => {
    if (kbTarget === id) setKbTarget(null);
    setParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectCategory = (category: any) => {
    if (category.is_subcategory) {
      setSelectedSubcategory(category);
      catSheetRef.current?.close();
    } else {
      setSelectedCategory(category);
      setSelectedSubcategory(null);
    }
  };

  const save = async () => {
    if (saving || loading) return;
    const total = evalCents(kbTarget === "amount" ? evaluateExpression() : amount);
    if (total <= 0) return setError("Enter an amount");
    if (!description.trim()) return setError("Add a description");
    if (orderedParticipants.length === 0) return setError("Pick who this is split between");
    const involved = new Set([payerId, ...orderedParticipants]);
    if (involved.size < 2) return setError("An expense needs at least two people");
    const finalShares = mode === "equal" ? equalShares(total, orderedParticipants) : shares;
    const finalSum = orderedParticipants.reduce((s, id) => s + (finalShares[id] ?? 0), 0);
    if (finalSum !== total) {
      return setError(`Shares add up to ${fmt(finalSum)}, not ${fmt(total)}`);
    }
    const myOwe = finalShares[me] ?? 0;
    if (addToTransaction && myOwe > 0 && (!selectedBank || !selectedCategory)) {
      return setError("Select account and category for the transaction");
    }

    setSaving(true);
    setError(null);
    try {
      const entryId = isEdit ? editEntryId! : (uuid.v4() as string);
      const ts = now();
      const ledgerEntry: LedgerEntryRow = {
        id: entryId,
        kind: "SPLIT",
        description: description.trim(),
        created_by: me,
        total_cents: total,
        created_at: isEdit ? editCreatedAt.current ?? ts : ts,
        updated_at: ts,
        is_deleted: false,
        grp_id: grpId,
      };

      // People dropped from an edited expense keep a zeroed line item so the
      // change syncs (rows are only ever upserted, never deleted).
      const userIds = new Set<string>([...involved, ...oldItems.current.map((i) => i.user_id)]);
      const lineItems: LineItemRow[] = Array.from(userIds).map((uid) => {
        const paid = uid === payerId ? total : 0;
        const owed = finalShares[uid] ?? 0;
        return {
          entry_id: entryId,
          user_id: uid,
          paid_cents: paid,
          owed_cents: owed,
          amount_cents: paid - owed,
          updated_at: ts,
        };
      });
      await addSplitData([ledgerEntry], lineItems);

      if (addToTransaction && myOwe > 0) {
        if (isEdit && editTxnId.current != null) {
          if (editCreatedAt.current) await ensureTransactionsLoadedFrom(new Date(editCreatedAt.current));
          const existing = useExpensifyStore.getState().transactions[String(editTxnId.current)];
          const updated = await updateTransaction({
            ...existing,
            id: editTxnId.current,
            description: description.trim(),
            amount: myOwe / 100,
            is_credit: false,
            account_id: selectedBank!.id,
            category_id: selectedCategory.id,
            subcategory_id: selectedSubcategory?.id || null,
            date_time: date.toISOString(),
          });
          updateTransactionInUI(updated);
        } else {
          const added = await addTransaction({
            id: null,
            description: description.trim(),
            amount: myOwe / 100,
            is_credit: false,
            account_id: selectedBank!.id,
            category_id: selectedCategory.id,
            subcategory_id: selectedSubcategory?.id || null,
            date_time: date.toISOString(),
          });
          addTransactionToUI(added);
          await linkTransactionToLedgerEntry(added.id, entryId);
        }
      }

      // Optimistic per-friend balance update (the server's balance_pair is
      // authoritative and replaces this on the next Balances refresh).
      const newImpact = balanceImpactByFriend(lineItems, me);
      const oldImpact = balanceImpactByFriend(oldItems.current, me);
      const deltas: Record<string, number> = {};
      new Set([...Object.keys(newImpact), ...Object.keys(oldImpact)]).forEach((id) => {
        deltas[id] = (newImpact[id] ?? 0) - (oldImpact[id] ?? 0);
      });
      const names: Record<string, string> = {};
      members.forEach((m) => (names[m.user_id] = m.user_name || "Unknown"));
      const balances = applyBalanceDeltas(userBalancesById, deltas, names);
      await updateUserBalances(balances);
      setUserBalancesInUI(balances);

      syncSplitsNow().catch(() => {});
      navigation.goBack();
    } catch (e: any) {
      setError(e?.message ?? "Couldn't save the expense");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const amtFloat = parseFloat(amount) || 0;
  const editingAmount = kbTarget === "amount";
  const editingMember = kbTarget && kbTarget !== "amount" ? kbTarget : null;
  const remainingCents = totalCents - sharesSum;

  return (
    <Provider>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Icon name="close" type="material-community" size={24} color={COLORS.ink} />
          </TouchableOpacity>
          <View style={{ alignItems: "center", flex: 1 }}>
            <Text style={styles.headerTitle}>{isEdit ? "Edit expense" : "Add expense"}</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>in {groupName}</Text>
          </View>
          <TouchableOpacity onPress={save} style={styles.headerBtn} disabled={saving}>
            {saving ? (
              <ActivityIndicator color={COLORS.ink} />
            ) : (
              <Icon name="check" type="material-community" size={24} color={COLORS.ink} />
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: SIZES.padding * 2 }} color={COLORS.ink} />
        ) : (
          <>
            <TouchableOpacity
              style={styles.amountSection}
              activeOpacity={0.8}
              onPress={() => openKeyboard("amount")}
            >
              {!(editingAmount && expression) && <Text style={styles.currencySymbol}>₹</Text>}
              <Text style={editingAmount && expression ? styles.amountExpression : styles.amountText}>
                {editingAmount && expression
                  ? expression
                  : amtFloat > 0
                    ? formatAmountWithCommas(amtFloat, false)
                    : "0"}
              </Text>
            </TouchableOpacity>

            <ScrollView
              ref={scrollRef}
              style={styles.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.descriptionRow}>
                <Icon name="pencil-outline" type="material-community" size={20} color={COLORS.inkMuted} />
                <TextInput
                  style={styles.descriptionInput}
                  placeholder="What was it for?"
                  placeholderTextColor={COLORS.inkMuted}
                  value={description}
                  onChangeText={setDescription}
                  onFocus={() => {
                    commitKeyboard();
                    setShowDatePicker(false);
                    setShowAccountPicker(false);
                  }}
                  returnKeyType="done"
                />
              </View>

              <Text style={styles.sectionLabel}>Paid by</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: SIZES.base }}
                style={{ marginBottom: SIZES.padding }}
              >
                {members.map((m) => {
                  const active = m.user_id === payerId;
                  const n = nameOf(m.user_id);
                  return (
                    <TouchableOpacity
                      key={m.user_id}
                      style={[styles.payerChip, active && styles.payerChipActive]}
                      onPress={() => {
                        dismissAll();
                        setPayerId(m.user_id);
                      }}
                    >
                      <Avatar name={n} size={22} />
                      <Text style={[styles.payerText, active && styles.payerTextActive]}>{n}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.splitHeader}>
                <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>Split</Text>
                <View style={styles.segment}>
                  {(["equal", "exact"] as SplitMode[]).map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.segmentPill, mode === m && styles.segmentPillActive]}
                      onPress={() => {
                        dismissAll();
                        if (m === "exact" && mode !== "exact") {
                          const ex: Record<string, string> = {};
                          orderedParticipants.forEach((id) => (ex[id] = String((shares[id] ?? 0) / 100)));
                          setExact(ex);
                        }
                        setMode(m);
                      }}
                    >
                      <Text style={[styles.segmentLabel, mode === m && styles.segmentLabelActive]}>
                        {m === "equal" ? "Equally" : "Exact amounts"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.card} onLayout={(e) => (cardY.current = e.nativeEvent.layout.y)}>
                {members.map((m, idx) => {
                  const on = participants.has(m.user_id);
                  const n = nameOf(m.user_id);
                  return (
                    <View
                      key={m.user_id}
                      onLayout={(e) => (rowY.current[m.user_id] = e.nativeEvent.layout.y)}
                    >
                      {idx > 0 && <View style={styles.divider} />}
                      <TouchableOpacity
                        style={[styles.memberRow, editingMember === m.user_id && styles.memberRowActive]}
                        activeOpacity={0.7}
                        onPress={() => {
                          dismissAll();
                          toggleParticipant(m.user_id);
                        }}
                      >
                        <Icon
                          name={on ? "checkbox-marked" : "checkbox-blank-outline"}
                          type="material-community"
                          size={22}
                          color={on ? COLORS.ink : COLORS.inkMuted}
                        />
                        <Avatar name={n} size={28} />
                        <Text style={styles.memberName} numberOfLines={1}>{n}</Text>
                        {on && mode === "equal" && (
                          <Text style={styles.shareText}>{fmt(shares[m.user_id] ?? 0)}</Text>
                        )}
                        {on && mode === "exact" && (
                          <TouchableOpacity
                            style={[styles.exactBox, editingMember === m.user_id && styles.exactBoxActive]}
                            activeOpacity={0.7}
                            onPress={() => openKeyboard(m.user_id)}
                          >
                            <Text style={styles.exactRupee}>₹</Text>
                            <Text
                              style={[
                                styles.exactValue,
                                !(editingMember === m.user_id ? expression : exact[m.user_id]) &&
                                  styles.exactPlaceholder,
                              ]}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                            >
                              {editingMember === m.user_id
                                ? expression || "0"
                                : evalCents(exact[m.user_id]) > 0
                                  ? formatAmountWithCommas(evalCents(exact[m.user_id]) / 100, false)
                                  : "0"}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
              {mode === "exact" && totalCents > 0 && sharesSum !== totalCents && (
                <Text style={styles.hintText}>
                  {sharesSum < totalCents
                    ? `${fmt(totalCents - sharesSum)} left to assign`
                    : `${fmt(sharesSum - totalCents)} over the total`}
                </Text>
              )}

              {myShare > 0 && (
                <TouchableOpacity
                  style={styles.toggleCard}
                  onPress={() => setAddToTransaction(!addToTransaction)}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={addToTransaction ? "checkbox-marked" : "checkbox-blank-outline"}
                    type="material-community"
                    size={22}
                    color={addToTransaction ? COLORS.ink : COLORS.inkMuted}
                  />
                  <Text style={styles.toggleLabel}>
                    Add my share ({fmt(myShare)}) as a transaction
                  </Text>
                </TouchableOpacity>
              )}

              {addToTransaction && myShare > 0 && (
                <View style={styles.card}>
                  <TouchableOpacity
                    style={styles.fieldRow}
                    onPress={() => {
                      dismissAll();
                      setTimeout(() => catSheetRef.current?.open(), 100);
                    }}
                  >
                    {selectedCategory ? (
                      <Icon name={selectedCategory.icon_name} type={selectedCategory.icon_type} size={20} color={COLORS.ink} />
                    ) : (
                      <Icon name="tag-outline" type="material-community" size={20} color={COLORS.inkMuted} />
                    )}
                    <Text style={[styles.fieldText, !selectedCategory && styles.fieldPlaceholder]}>
                      {selectedCategory
                        ? selectedCategory.name + (selectedSubcategory ? " → " + selectedSubcategory.name : "")
                        : "What kind?"}
                    </Text>
                    <Icon name="chevron-right" type="material-community" size={20} color={COLORS.inkSubtle} />
                  </TouchableOpacity>
                  <View style={styles.divider} />
                  <TouchableOpacity
                    style={styles.fieldRow}
                    onPress={() => {
                      dismissAll();
                      setShowAccountPicker(!showAccountPicker);
                    }}
                  >
                    <Icon name="wallet-outline" type="material-community" size={20} color={COLORS.inkMuted} />
                    <Text style={[styles.fieldText, !selectedBank && styles.fieldPlaceholder]}>
                      {selectedBank?.name || "From where?"}
                    </Text>
                    <Icon name="chevron-right" type="material-community" size={20} color={COLORS.inkSubtle} />
                  </TouchableOpacity>
                  {showAccountPicker && (
                    <View style={styles.inlinePicker}>
                      {accounts.map((account) => (
                        <TouchableOpacity
                          key={account.id}
                          style={[styles.pickerItem, selectedBank?.id === account.id && styles.pickerItemActive]}
                          onPress={() => {
                            setSelectedBank(account);
                            setShowAccountPicker(false);
                          }}
                        >
                          <Text style={[styles.pickerItemText, selectedBank?.id === account.id && styles.pickerItemTextActive]}>
                            {account.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  <View style={styles.divider} />
                  <TouchableOpacity
                    style={styles.fieldRow}
                    onPress={() => {
                      dismissAll();
                      setShowDatePicker(!showDatePicker);
                    }}
                  >
                    <Icon name="calendar-outline" type="material-community" size={20} color={COLORS.inkMuted} />
                    <Text style={styles.fieldText}>{formatDate(date)}</Text>
                    <Icon name="chevron-right" type="material-community" size={20} color={COLORS.inkSubtle} />
                  </TouchableOpacity>
                  {showDatePicker && (
                    <View style={{ alignItems: "center", paddingBottom: SIZES.base }}>
                      <DateTimePicker
                        value={date}
                        mode="date"
                        display="inline"
                        maximumDate={new Date()}
                        themeVariant={isDark ? "dark" : "light"}
                        style={{ height: 320 }}
                        onChange={(_: any, d?: Date) => {
                          setShowDatePicker(false);
                          if (!d) return;
                          const n = new Date();
                          d.setHours(n.getHours(), n.getMinutes(), n.getSeconds());
                          setDate(d);
                        }}
                      />
                    </View>
                  )}
                </View>
              )}

              {error && <Text style={styles.errorText}>{error}</Text>}
              <View style={{ height: showKeyboard ? SIZES.height * 0.35 : 120 }} />
            </ScrollView>
          </>
        )}

        <CategoryBottomSheet ref={catSheetRef} categories={categories} onSelect={handleSelectCategory} />

        {showKeyboard && (
          <View style={{ backgroundColor: COLORS.paper }}>
            {editingMember && (
              <View style={styles.kbContext}>
                <Avatar name={nameOf(editingMember)} size={24} />
                <Text style={styles.kbContextName} numberOfLines={1}>
                  {nameOf(editingMember) === "You" ? "Your share" : `${nameOf(editingMember)}'s share`}
                </Text>
                {remainingCents === 0 ? (
                  <Text style={[styles.kbContextHint, { color: COLORS.deltaDown }]}>All assigned</Text>
                ) : remainingCents > 0 ? (
                  <TouchableOpacity
                    style={styles.fillChip}
                    onPress={() => {
                      const filled = String((evalCents(exact[editingMember]) + remainingCents) / 100);
                      resetExpression(filled);
                      setExact((prev) => ({ ...prev, [editingMember]: filled }));
                    }}
                  >
                    <Text style={styles.fillChipText}>+ {fmt(remainingCents)} left</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={[styles.kbContextHint, { color: COLORS.deltaUp }]}>
                    {fmt(-remainingCents)} over
                  </Text>
                )}
              </View>
            )}
            <CustomKeyboard
              onKeyPress={(key) => {
                if (key === "Done") {
                  commitKeyboard();
                  return;
                }
                const result = String(onKeyPress(key));
                if (kbTarget === "amount") setAmount(result);
                else if (kbTarget) setExact((prev) => ({ ...prev, [kbTarget]: result }));
              }}
            />
          </View>
        )}
      </View>
    </Provider>
  );
};

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.paper },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: SIZES.padding,
      paddingTop: SIZES.padding * 2.5,
      paddingBottom: SIZES.base,
    },
    headerBtn: { padding: 4, minWidth: 32, alignItems: "center" },
    headerTitle: { ...FONTS.h3, fontFamily: FONT.bold, color: COLORS.ink },
    headerSubtitle: { ...FONTS.body4, fontSize: 12, color: COLORS.inkMuted, marginTop: 1 },
    amountSection: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "center",
      paddingVertical: SIZES.padding * 0.8,
    },
    currencySymbol: { ...FONTS.h2, fontSize: 22, color: COLORS.inkMuted, fontFamily: FONT.regular, marginRight: 4 },
    amountText: { fontSize: 40, letterSpacing: -1.5, fontFamily: FONT.bold, color: COLORS.ink },
    amountExpression: { fontSize: 28, letterSpacing: -0.5, fontFamily: FONT.regular, color: COLORS.ink },
    scroll: { flex: 1, paddingHorizontal: SIZES.padding },
    descriptionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SIZES.base + 2,
      marginBottom: SIZES.padding,
      paddingHorizontal: 4,
    },
    descriptionInput: {
      flex: 1,
      ...FONTS.body2,
      color: COLORS.ink,
      fontFamily: FONT.medium,
      paddingVertical: SIZES.base,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.hairline + "50",
    },
    sectionLabel: {
      ...FONTS.caption,
      color: COLORS.inkMuted,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      marginBottom: SIZES.base,
    },
    payerChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: COLORS.surface1,
      borderRadius: 18,
      paddingLeft: 4,
      paddingRight: 12,
      paddingVertical: 4,
    },
    payerChipActive: { backgroundColor: COLORS.ink },
    payerText: { ...FONTS.body4, color: COLORS.ink, fontFamily: FONT.medium },
    payerTextActive: { color: COLORS.paper },
    splitHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: SIZES.base,
    },
    segment: { flexDirection: "row", backgroundColor: COLORS.surface1, borderRadius: 8, padding: 2 },
    segmentPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
    segmentPillActive: { backgroundColor: COLORS.paper },
    segmentLabel: { ...FONTS.caption, color: COLORS.inkMuted, fontFamily: FONT.medium },
    segmentLabelActive: { color: COLORS.ink, fontFamily: FONT.bold },
    card: { backgroundColor: COLORS.surface1, borderRadius: 14, overflow: "hidden", marginBottom: SIZES.base + 4 },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: COLORS.hairline,
      marginHorizontal: SIZES.padding * 0.7,
      opacity: 0.3,
    },
    memberRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SIZES.base + 2,
      paddingHorizontal: SIZES.padding * 0.7,
      paddingVertical: SIZES.base + 2,
    },
    memberName: { ...FONTS.body3, color: COLORS.ink, fontFamily: FONT.medium, flex: 1 },
    shareText: { ...FONTS.body3, color: COLORS.inkMuted },
    memberRowActive: { backgroundColor: COLORS.accentSoft },
    exactBox: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: COLORS.paper,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: "transparent",
      paddingHorizontal: 8,
      paddingVertical: 6,
      minWidth: 96,
      maxWidth: 150,
    },
    exactBoxActive: { borderColor: COLORS.accent },
    exactRupee: { ...FONTS.body4, color: COLORS.inkMuted },
    exactValue: { ...FONTS.amountInline, color: COLORS.ink, flex: 1, textAlign: "right" },
    exactPlaceholder: { color: COLORS.inkSubtle },
    kbContext: {
      flexDirection: "row",
      alignItems: "center",
      gap: SIZES.base,
      paddingHorizontal: SIZES.padding,
      paddingVertical: SIZES.base,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.hairline,
    },
    kbContextName: { ...FONTS.bodyM, fontFamily: FONT.bold, color: COLORS.ink, flex: 1 },
    kbContextHint: { ...FONTS.bodyS, fontFamily: FONT.bold },
    fillChip: {
      backgroundColor: COLORS.accentSoft,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    fillChipText: { ...FONTS.bodyS, fontFamily: FONT.bold, color: COLORS.accent },
    hintText: { ...FONTS.body4, color: COLORS.deltaUp, marginBottom: SIZES.base + 4, marginLeft: 4 },
    toggleCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: SIZES.base + 2,
      backgroundColor: COLORS.surface1,
      borderRadius: 12,
      paddingHorizontal: SIZES.padding * 0.7,
      paddingVertical: SIZES.base + 4,
      marginBottom: SIZES.base + 4,
    },
    toggleLabel: { ...FONTS.body3, fontFamily: FONT.medium, color: COLORS.ink, flex: 1 },
    fieldRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: SIZES.padding * 0.7,
      paddingVertical: SIZES.base + 5,
      gap: SIZES.base + 2,
    },
    fieldText: { ...FONTS.body3, color: COLORS.ink, fontFamily: FONT.medium, flex: 1 },
    fieldPlaceholder: { color: COLORS.inkMuted, fontFamily: FONT.regular },
    inlinePicker: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: SIZES.base,
      paddingHorizontal: SIZES.padding * 0.7,
      paddingBottom: SIZES.base + 4,
    },
    pickerItem: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.paper },
    pickerItemActive: { backgroundColor: COLORS.ink },
    pickerItemText: { ...FONTS.body4, fontFamily: FONT.medium, color: COLORS.ink },
    pickerItemTextActive: { color: COLORS.paper },
    errorText: { ...FONTS.body4, color: COLORS.deltaUp, marginTop: SIZES.base, marginLeft: 4 },
  });

export default AddGroupExpenseScreen;

import React, { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  useWindowDimensions,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import uuid from "react-native-uuid";
import { evaluate } from "mathjs";
import { RADIUS, SPACE } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { useExpensifyStore } from "../store/store";
import {
  CustomKeyboard,
  useCustomKeyboard,
} from "../components/CustomKeyboard";
import CategoryBottomSheet, {
  CategoryBottomSheetRef,
} from "../components/CategoryBottomSheet";
import {
  Amount,
  Avatar,
  Field,
  Form,
  FormRef,
  GlyphPlate,
  Icon,
  ListRow,
  Pressable,
  RowGroup,
  SectionLabel,
  SegmentedControl,
  Sheet,
  SheetRef,
  SkeletonList,
  Text,
  formatMoney,
  toast,
  hapticRhythm,
} from "../components/ui";
import { markChanged, markTotalChanged } from "../services/Feedback";
import { fetchGroupDetail } from "../services/Groups";
import {
  addSplitData,
  applyBalanceDeltas,
  balanceImpactByFriend,
  fetchSplitSummary,
  linkTransactionToLedgerEntry,
  updateUserBalances,
} from "../services/Splits";
import {
  addTransaction,
  updateTransaction,
} from "../services/TransactionService";
import { ensureTransactionsLoadedFrom } from "../services/TransactionWindow";
import { syncSplitsNow } from "../services/BackgroundSync";
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
const fmt = (cents: number) => formatMoney(cents);
const colorForId = (id: number, palette: readonly string[]) =>
  palette[Math.abs(id) % palette.length];

// Separators in the member list start under the name (checkbox + avatar lead).
const MEMBER_INSET = SPACE.lg + 22 + SPACE.sm + 28 + SPACE.md;
const ICON_INSET = SPACE.lg + 34 + SPACE.md;

// Equal shares; leftover cents go to the first participants in order so the
// shares always sum to the total exactly.
const equalShares = (
  totalCents: number,
  ids: string[],
): Record<string, number> => {
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
  const { height: windowHeight } = useWindowDimensions();
  const form = useRef<FormRef>(null);
  const route = useRoute<any>();
  const { grpId, entryId: editEntryId } = route.params as {
    grpId: string;
    entryId?: string;
  };
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
  const [saving, setSaving] = useState(false);

  // Edit-mode state preserved across the save.
  const oldItems = useRef<ItemLike[]>([]);
  const editCreatedAt = useRef<string | null>(null);
  const editTxnId = useRef<number | null>(null);

  const { expression, onKeyPress, evaluateExpression, resetExpression } =
    useCustomKeyboard("");
  const catSheetRef = useRef<CategoryBottomSheetRef>(null);
  const payerSheetRef = useRef<SheetRef>(null);
  const accountSheetRef = useRef<SheetRef>(null);
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
            .forEach(
              (i) =>
                (roster = [
                  ...roster,
                  {
                    grp_id: grpId,
                    user_id: i.user_id,
                    user_name:
                      userBalancesById[i.user_id]?.name ?? "Former member",
                    joined_at: "",
                    updated_at: "",
                    is_deleted: true,
                  },
                ]),
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
          const eq = equalShares(
            total,
            roster
              .map((m) => m.user_id)
              .filter((id) => owing.some((o) => o.user_id === id)),
          );
          const isEqual = owing.every(
            (i) => Math.abs((eq[i.user_id] ?? 0) - i.owed_cents) <= 1,
          );
          if (!isEqual) {
            setMode("exact");
            const ex: Record<string, string> = {};
            owing.forEach((i) => (ex[i.user_id] = String(i.owed_cents / 100)));
            setExact(ex);
          }

          if (res.transaction_id) {
            if (res.created_at)
              await ensureTransactionsLoadedFrom(new Date(res.created_at));
            const txn =
              useExpensifyStore.getState().transactions[
                String(res.transaction_id)
              ];
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
        toast("Couldn't load the group", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const nameOf = (id: string) =>
    id === me
      ? "You"
      : members.find((m) => m.user_id === id)?.user_name || "Someone";

  const totalCents = toCents(amount);
  const orderedParticipants = members
    .map((m) => m.user_id)
    .filter((id) => participants.has(id));
  const shares: Record<string, number> =
    mode === "equal"
      ? equalShares(totalCents, orderedParticipants)
      : Object.fromEntries(
          orderedParticipants.map((id) => [id, evalCents(exact[id])]),
        );
  const sharesSum = orderedParticipants.reduce(
    (s, id) => s + (shares[id] ?? 0),
    0,
  );
  const myShare = shares[me] ?? 0;

  // Snapshot of everything the user can change, taken once loading finishes,
  // so `dirty` is accurate for both add and edit.
  const snapshot = JSON.stringify([
    description,
    amount,
    payerId,
    Array.from(participants).sort(),
    mode,
    exact,
    addToTransaction,
    selectedBank?.id ?? null,
    selectedCategory?.id ?? null,
    selectedSubcategory?.id ?? null,
    date.toDateString(),
  ]);
  const initialSnapshot = useRef<string | null>(null);
  useEffect(() => {
    if (!loading && initialSnapshot.current === null)
      initialSnapshot.current = snapshot;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);
  const dirty =
    initialSnapshot.current !== null && snapshot !== initialSnapshot.current;

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
    catSheetRef.current?.close();
    Keyboard.dismiss();
    if (target === "amount") {
      resetExpression(amtFloat > 0 ? amount : "");
    } else {
      resetExpression(evalCents(exact[target]) > 0 ? exact[target] : "");
      // Wait for the keyboard to shrink the scroll view, then bring the row into view.
      setTimeout(() => {
        const y = cardY.current + (rowY.current[target] ?? 0);
        scrollRef.current?.scrollTo({
          y: Math.max(0, y - SPACE.xxxl),
          animated: true,
        });
      }, 80);
    }
    setKbTarget(target);
  };

  const dismissAll = () => {
    commitKeyboard();
    setShowDatePicker(false);
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

  const changeMode = (m: SplitMode) => {
    dismissAll();
    if (m === "exact" && mode !== "exact") {
      const ex: Record<string, string> = {};
      orderedParticipants.forEach(
        (id) => (ex[id] = String((shares[id] ?? 0) / 100)),
      );
      setExact(ex);
    }
    setMode(m);
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

  const fail = (message: string) => {
    toast(message, "error");
  };

  const save = async () => {
    if (saving || loading) return;
    const total = evalCents(
      kbTarget === "amount" ? evaluateExpression() : amount,
    );
    if (total <= 0) return fail("Enter an amount");
    if (!description.trim()) return fail("Add a description");
    if (orderedParticipants.length === 0)
      return fail("Pick who this is split between");
    const involved = new Set([payerId, ...orderedParticipants]);
    if (involved.size < 2) return fail("An expense needs at least two people");
    const finalShares =
      mode === "equal" ? equalShares(total, orderedParticipants) : shares;
    const finalSum = orderedParticipants.reduce(
      (s, id) => s + (finalShares[id] ?? 0),
      0,
    );
    if (finalSum !== total) {
      return fail(`Shares add up to ${fmt(finalSum)}, not ${fmt(total)}`);
    }
    const myOwe = finalShares[me] ?? 0;
    if (addToTransaction && myOwe > 0 && (!selectedBank || !selectedCategory)) {
      return fail("Select account and category for the transaction");
    }

    setSaving(true);
    try {
      const entryId = isEdit ? editEntryId! : (uuid.v4() as string);
      const ts = now();
      const ledgerEntry: LedgerEntryRow = {
        id: entryId,
        kind: "SPLIT",
        description: description.trim(),
        created_by: me,
        total_cents: total,
        created_at: isEdit ? (editCreatedAt.current ?? ts) : ts,
        updated_at: ts,
        is_deleted: false,
        grp_id: grpId,
      };

      // People dropped from an edited expense keep a zeroed line item so the
      // change syncs (rows are only ever upserted, never deleted).
      const userIds = new Set<string>([
        ...involved,
        ...oldItems.current.map((i) => i.user_id),
      ]);
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
          if (editCreatedAt.current)
            await ensureTransactionsLoadedFrom(new Date(editCreatedAt.current));
          const existing =
            useExpensifyStore.getState().transactions[
              String(editTxnId.current)
            ];
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
      new Set([...Object.keys(newImpact), ...Object.keys(oldImpact)]).forEach(
        (id) => {
          deltas[id] = (newImpact[id] ?? 0) - (oldImpact[id] ?? 0);
        },
      );
      const names: Record<string, string> = {};
      members.forEach((m) => (names[m.user_id] = m.user_name || "Unknown"));
      const balances = applyBalanceDeltas(userBalancesById, deltas, names);
      await updateUserBalances(balances);
      setUserBalancesInUI(balances);

      syncSplitsNow().catch(() => {});
      markChanged("groupExpense", [entryId], isEdit ? "edited" : "added");
      markChanged("friend", Object.keys(deltas).filter((id) => deltas[id] !== 0), "edited");
      markTotalChanged(
        `group:${grpId}`,
        (newImpact[me] ?? 0) - (oldImpact[me] ?? 0),
      );
      hapticRhythm("saveLanded");
      form.current?.close();
    } catch (e: any) {
      fail(e?.message ?? "Couldn't save the expense");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const amtFloat = parseFloat(amount) || 0;
  const editingAmount = kbTarget === "amount";
  const editingMember = kbTarget && kbTarget !== "amount" ? kbTarget : null;
  const remainingCents = totalCents - sharesSum;

  // Custom keypad pinned under the form; when editing a member's exact share
  // a context strip shows whose share it is and what's left to assign.
  const keypad = showKeyboard ? (
    <View style={{ backgroundColor: COLORS.paper }}>
      {editingMember && (
        <View style={[styles.kbContext, { borderTopColor: COLORS.hairline }]}>
          <Avatar name={nameOf(editingMember)} size={24} />
          <Text variant="headline" numberOfLines={1} style={styles.flex}>
            {nameOf(editingMember) === "You"
              ? "Your share"
              : `${nameOf(editingMember)}'s share`}
          </Text>
          {remainingCents === 0 ? (
            <Text variant="callout" tone="down">
              All assigned
            </Text>
          ) : remainingCents > 0 ? (
            <Pressable
              haptic="selection"
              accessibilityLabel={`Assign the remaining ${fmt(remainingCents)}`}
              style={[styles.fill, { backgroundColor: COLORS.accentSoft }]}
              onPress={() => {
                const filled = String(
                  (evalCents(exact[editingMember]) + remainingCents) / 100,
                );
                resetExpression(filled);
                setExact((prev) => ({ ...prev, [editingMember]: filled }));
              }}
            >
              <Text variant="callout" tone="accent">
                + {fmt(remainingCents)} left
              </Text>
            </Pressable>
          ) : (
            <Text variant="callout" tone="up">
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
          else if (kbTarget)
            setExact((prev) => ({ ...prev, [kbTarget]: result }));
        }}
      />
    </View>
  ) : null;

  return (
    <Form
      ref={form}
      title={isEdit ? "Edit expense" : "Add expense"}
      onSave={save}
      canSave={!loading}
      saving={saving}
      dirty={dirty}
      scroll={false}
      padded={false}
      footer={keypad}
    >
      {loading ? (
        <View style={styles.gutter}>
          <SkeletonList rows={5} />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[
            styles.gutter,
            { paddingBottom: showKeyboard ? windowHeight * 0.35 : SPACE.xxxl },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            scale={false}
            accessibilityLabel="Amount"
            onPress={() => openKeyboard("amount")}
            style={styles.amountHero}
          >
            {!!groupName && (
              <Text
                variant="callout"
                tone="muted"
                align="center"
                numberOfLines={1}
              >
                in {groupName}
              </Text>
            )}
            {editingAmount && expression ? (
              <Text
                variant="amountLarge"
                align="center"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={styles.amount}
              >
                {expression}
              </Text>
            ) : (
              <Amount
                cents={totalCents}
                variant="display"
                tone={
                  editingAmount ? "accent" : totalCents > 0 ? "ink" : "subtle"
                }
                style={styles.amount}
              />
            )}
          </Pressable>

          <RowGroup inset={ICON_INSET}>
            <Field
              icon="pencil-outline"
              placeholder="What was it for?"
              value={description}
              onChangeText={setDescription}
              onFocus={() => {
                commitKeyboard();
                setShowDatePicker(false);
              }}
              returnKeyType="done"
            />
            <ListRow
              leading={<Avatar name={nameOf(payerId)} size={34} />}
              title="Paid by"
              value={nameOf(payerId)}
              chevron
              onPress={() => {
                dismissAll();
                payerSheetRef.current?.present();
              }}
            />
          </RowGroup>

          <SectionLabel
            title="Split"
            right={
              <SegmentedControl
                size="sm"
                value={mode}
                onChange={changeMode}
                options={[
                  { key: "equal", label: "Equally" },
                  { key: "exact", label: "Exact" },
                ]}
                style={styles.segment}
              />
            }
          />

          <View onLayout={(e) => (cardY.current = e.nativeEvent.layout.y)}>
            <RowGroup inset={MEMBER_INSET}>
              {members.map((m) => {
                const on = participants.has(m.user_id);
                const n = nameOf(m.user_id);
                const editing = editingMember === m.user_id;
                const exactCents = evalCents(exact[m.user_id]);
                return (
                  <View
                    key={m.user_id}
                    onLayout={(e) =>
                      (rowY.current[m.user_id] = e.nativeEvent.layout.y)
                    }
                  >
                    <ListRow
                      dense
                      style={
                        editing
                          ? { backgroundColor: COLORS.accentSoft }
                          : undefined
                      }
                      leading={
                        <View style={styles.memberLead}>
                          <Icon
                            name={
                              on
                                ? "checkbox-marked-circle"
                                : "checkbox-blank-circle-outline"
                            }
                            size={22}
                            color={on ? COLORS.accent : COLORS.inkSubtle}
                          />
                          <Avatar name={n} size={28} />
                        </View>
                      }
                      title={n}
                      onPress={() => {
                        dismissAll();
                        toggleParticipant(m.user_id);
                      }}
                      trailing={
                        !on ? null : mode === "equal" ? (
                          <Amount
                            cents={shares[m.user_id] ?? 0}
                            variant="body"
                            tone="muted"
                          />
                        ) : (
                          <Pressable
                            haptic="selection"
                            accessibilityLabel={`${n}'s share`}
                            onPress={() => openKeyboard(m.user_id)}
                            style={[
                              styles.exactBox,
                              {
                                backgroundColor: COLORS.paper,
                                borderColor: editing
                                  ? COLORS.accent
                                  : COLORS.hairline,
                              },
                            ]}
                          >
                            <Text variant="callout" tone="muted">
                              ₹
                            </Text>
                            <Text
                              variant="amount"
                              tone={
                                (editing ? expression : exactCents > 0)
                                  ? "ink"
                                  : "subtle"
                              }
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              style={styles.exactValue}
                            >
                              {editing
                                ? expression || "0"
                                : exactCents > 0
                                  ? formatMoney(exactCents).replace("₹", "")
                                  : "0"}
                            </Text>
                          </Pressable>
                        )
                      }
                    />
                  </View>
                );
              })}
            </RowGroup>
          </View>
          {mode === "exact" && totalCents > 0 && sharesSum !== totalCents && (
            <Text variant="callout" tone="up" style={styles.hint}>
              {sharesSum < totalCents
                ? `${fmt(totalCents - sharesSum)} left to assign`
                : `${fmt(sharesSum - totalCents)} over the total`}
            </Text>
          )}

          {myShare > 0 && (
            <RowGroup inset={ICON_INSET} style={styles.section}>
              <ListRow
                icon="receipt"
                title="Add to my spending"
                subtitle={`Log my share of ${fmt(myShare)} as a transaction`}
                onPress={() => setAddToTransaction(!addToTransaction)}
                trailing={
                  <Switch
                    value={addToTransaction}
                    onValueChange={setAddToTransaction}
                    trackColor={{ true: COLORS.accent }}
                  />
                }
              />
              {addToTransaction && (
                <ListRow
                  leading={
                    selectedCategory ? (
                      <GlyphPlate
                        name={
                          (selectedSubcategory ?? selectedCategory).icon_name
                        }
                        type={
                          (selectedSubcategory ?? selectedCategory).icon_type
                        }
                        color={colorForId(
                          (selectedSubcategory ?? selectedCategory).id,
                          COLORS.ordinal,
                        )}
                        size={34}
                        radius={10}
                      />
                    ) : undefined
                  }
                  icon="tag-outline"
                  iconColor={COLORS.inkMuted}
                  title={
                    selectedCategory
                      ? selectedCategory.name +
                        (selectedSubcategory
                          ? " → " + selectedSubcategory.name
                          : "")
                      : "Category"
                  }
                  placeholder={!selectedCategory}
                  chevron
                  onPress={() => {
                    dismissAll();
                    setTimeout(() => catSheetRef.current?.open(), 100);
                  }}
                />
              )}
              {addToTransaction && (
                <ListRow
                  icon="wallet-outline"
                  iconColor={selectedBank ? COLORS.accent : COLORS.inkMuted}
                  title={selectedBank?.name || "Account"}
                  placeholder={!selectedBank}
                  chevron
                  onPress={() => {
                    dismissAll();
                    accountSheetRef.current?.present();
                  }}
                />
              )}
              {addToTransaction && (
                <ListRow
                  icon="calendar-outline"
                  title={formatDate(date)}
                  chevron
                  onPress={() => {
                    dismissAll();
                    setShowDatePicker(!showDatePicker);
                  }}
                />
              )}
              {addToTransaction && showDatePicker && (
                <View style={styles.datePicker}>
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display="inline"
                    maximumDate={new Date()}
                    themeVariant={isDark ? "dark" : "light"}
                    accentColor={COLORS.accent}
                    style={styles.datePickerInner}
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
            </RowGroup>
          )}
        </ScrollView>
      )}

      <CategoryBottomSheet
        ref={catSheetRef}
        categories={categories}
        onSelect={handleSelectCategory}
      />

      <Sheet ref={payerSheetRef} title="Paid by">
        {members.map((m) => {
          const n = nameOf(m.user_id);
          return (
            <ListRow
              key={m.user_id}
              padded={false}
              leading={<Avatar name={n} size={34} />}
              title={n}
              trailing={
                m.user_id === payerId ? (
                  <Icon name="check" size="md" color={COLORS.accent} />
                ) : undefined
              }
              onPress={() => {
                setPayerId(m.user_id);
                payerSheetRef.current?.dismiss();
              }}
            />
          );
        })}
      </Sheet>

      <Sheet ref={accountSheetRef} title="Account">
        {accounts.map((account) => (
          <ListRow
            key={account.id}
            padded={false}
            icon="wallet-outline"
            title={account.name}
            trailing={
              selectedBank?.id === account.id ? (
                <Icon name="check" size="md" color={COLORS.accent} />
              ) : undefined
            }
            onPress={() => {
              setSelectedBank(account);
              accountSheetRef.current?.dismiss();
            }}
          />
        ))}
      </Sheet>
    </Form>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gutter: { paddingHorizontal: SPACE.gutter },
  amountHero: {
    alignItems: "center",
    paddingTop: SPACE.lg,
    paddingBottom: SPACE.xl,
  },
  amount: { marginTop: SPACE.xs },
  segment: { width: 170 },
  section: { marginTop: SPACE.xl },
  memberLead: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  exactBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs + 2,
    minWidth: 96,
    maxWidth: 150,
  },
  exactValue: { flex: 1, textAlign: "right" },
  hint: { marginTop: SPACE.sm },
  datePicker: { alignItems: "center", paddingBottom: SPACE.sm },
  datePickerInner: { height: 320 },
  kbContext: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.gutter,
    paddingVertical: SPACE.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  fill: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
  },
});

export default AddGroupExpenseScreen;

import React, { useEffect, useRef, useState } from "react";
import { Keyboard, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import uuid from "react-native-uuid";
import { RADIUS, SPACE } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { CustomKeyboard, useCustomKeyboard } from "../components/CustomKeyboard";
import CategoryBottomSheet, { CategoryBottomSheetRef } from "../components/CategoryBottomSheet";
import {
  Amount,
  Button,
  Field,
  Form,
  FormRef,
  GlyphPlate,
  Icon,
  ListRow,
  Pressable,
  RowGroup,
  SegmentedControl,
  Sheet,
  SheetRef,
  Text,
  confirm,
  toast,
} from "../components/ui";
import { useExpensifyStore } from "../store/store";
import { addFundEntry, updateFundEntry, deleteFundEntry } from "../services/Funds";
import { addTransaction, updateTransaction } from "../services/TransactionService";
import { ensureTransactionsLoadedFrom } from "../services/TransactionWindow";
import { Fund } from "../types/entity/Fund";
import { FundEntry, FundEntryDirection } from "../types/entity/FundEntry";

const SUGGESTIONS = ["Monthly top-up", "Bonus", "Interest", "Gift", "Emergency withdrawal"];

const rupeesToCents = (rupees: number | string): number => {
  const num = typeof rupees === "string" ? parseFloat(rupees) : rupees;
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
};
const centsToRupees = (cents: number): number => cents / 100;

const formatDate = (d: Date) => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

const colorForId = (id: number, palette: readonly string[]) => palette[Math.abs(id) % palette.length];
const ICON_INSET = SPACE.lg + 34 + SPACE.md;

const AddFundEntryScreen: React.FC = () => {
  const { COLORS, isDark } = useTheme();
  const form = useRef<FormRef>(null);
  const route = useRoute<any>();

  const { fund, direction: initialDirection, entry: editEntry } = route.params as {
    fund: Fund;
    direction?: FundEntryDirection;
    entry?: FundEntry;
  };
  const isEditing = editEntry != null;
  const me = useExpensifyStore((s) => s.getUserId());
  const categoriesById = useExpensifyStore((s) => s.categories);
  const accountsById = useExpensifyStore((s) => s.accounts);
  const categories = Object.values(categoriesById).filter((c) => !c.is_deleted);
  const accounts = Object.values(accountsById).filter((a) => !a.is_deleted);
  const addTransactionToUI = useExpensifyStore((s) => s.addTransaction);
  const updateTransactionInUI = useExpensifyStore((s) => s.updateTransactions);

  const [direction, setDirection] = useState<FundEntryDirection>(
    editEntry?.direction ?? initialDirection ?? "CONTRIBUTION",
  );
  const [amount, setAmount] = useState(
    editEntry ? String(centsToRupees(editEntry.amount_cents)) : "0",
  );
  const [showKeyboard, setShowKeyboard] = useState(false);
  const { expression, onKeyPress, evaluateExpression, resetExpression } = useCustomKeyboard("");
  const [note, setNote] = useState(editEntry?.note ?? "");
  const [date, setDate] = useState(editEntry ? new Date(editEntry.created_at) : new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [addToTransaction, setAddToTransaction] = useState(editEntry?.linked_transaction_id != null);
  const [selectedBank, setSelectedBank] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [hydratingLink, setHydratingLink] = useState(editEntry?.linked_transaction_id != null);
  const [saving, setSaving] = useState(false);

  const catSheetRef = useRef<CategoryBottomSheetRef>(null);
  const accountSheetRef = useRef<SheetRef>(null);

  // Editing an entry that's linked to a transaction — hydrate the account/
  // category fields from it (the transaction can be older than the 6-month
  // hot window, same reasoning as AddSplitScreen's edit-mode hydration).
  useEffect(() => {
    const linkedId = editEntry?.linked_transaction_id;
    if (linkedId == null) return;
    (async () => {
      if (editEntry?.created_at) {
        await ensureTransactionsLoadedFrom(new Date(editEntry.created_at));
      }
      const txn = useExpensifyStore.getState().transactions[String(linkedId)];
      if (txn) {
        setSelectedBank(accountsById[txn.account_id] ?? null);
        setSelectedCategory(categoriesById[txn.subcategory_id || txn.category_id] ?? null);
      }
      setHydratingLink(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Snapshot taken once the linked-transaction fields have hydrated, so
  // `dirty` only reflects the user's own edits.
  const snapshot = JSON.stringify([
    direction,
    amount,
    note,
    date.toDateString(),
    addToTransaction,
    selectedBank?.id ?? null,
    selectedCategory?.id ?? null,
  ]);
  const initialSnapshot = useRef<string | null>(null);
  useEffect(() => {
    if (!hydratingLink && initialSnapshot.current === null) initialSnapshot.current = snapshot;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydratingLink]);
  const dirty = initialSnapshot.current !== null && snapshot !== initialSnapshot.current;

  const dismissAll = () => {
    Keyboard.dismiss();
    setShowKeyboard(false);
    setShowDatePicker(false);
    catSheetRef.current?.close();
  };

  const handleAmountTap = () => {
    dismissAll();
    resetExpression(amount !== "0" ? amount : "");
    setShowKeyboard(true);
  };

  const handleSelectCategory = (category: any) => {
    setSelectedCategory(category);
  };

  const handleDateChange = (_: any, selectedDate?: Date) => {
    if (!selectedDate) {
      setShowDatePicker(false);
      return;
    }
    setDate(selectedDate);
    setShowDatePicker(false);
  };

  const handleSave = async () => {
    if (hydratingLink || saving) return; // wait for the linked-transaction fields to hydrate
    const amountCents = rupeesToCents(amount);
    if (amountCents <= 0) {
      toast("Enter an amount", "error");
      return;
    }
    if (addToTransaction && (!selectedBank || !selectedCategory)) {
      toast("Select account and category for the transaction", "error");
      return;
    }
    if (!me) {
      toast("You need to be signed in", "error");
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      let linkedTransactionId = editEntry?.linked_transaction_id;

      if (addToTransaction) {
        const txnPayload = {
          id: null as any,
          description: note.trim() || fund.name,
          amount: centsToRupees(amountCents),
          is_credit: direction === "WITHDRAWAL",
          account_id: selectedBank.id,
          category_id: selectedCategory.id,
          subcategory_id: null,
          date_time: date.toISOString(),
        };
        if (isEditing && linkedTransactionId != null) {
          const existing = useExpensifyStore.getState().transactions[String(linkedTransactionId)];
          const updated = await updateTransaction({ ...existing, ...txnPayload, id: linkedTransactionId });
          updateTransactionInUI(updated);
        } else {
          const added = await addTransaction(txnPayload);
          addTransactionToUI(added);
          linkedTransactionId = added.id;
        }
      }

      const entry: FundEntry = {
        id: editEntry?.id ?? (uuid.v4() as string),
        fund_id: fund.id,
        contributor_id: editEntry?.contributor_id ?? me,
        amount_cents: amountCents,
        direction,
        note: note.trim() || undefined,
        linked_transaction_id: linkedTransactionId,
        created_at: editEntry?.created_at ?? date.toISOString(),
        updated_at: now,
        is_deleted: false,
      };

      if (isEditing) {
        await updateFundEntry(entry);
      } else {
        await addFundEntry(entry);
      }
      toast(isEditing ? "Entry updated" : direction === "WITHDRAWAL" ? "Withdrawal added" : "Contribution added");
      form.current?.close();
    } catch {
      toast("Couldn't save the entry", "error");
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editEntry) return;
    const ok = await confirm({ title: "Delete this entry?", message: "This can't be undone." });
    if (!ok) return;
    try {
      await deleteFundEntry(editEntry.id);
      toast("Entry deleted");
      form.current?.close();
    } catch {
      toast("Couldn't delete the entry", "error");
    }
  };

  const amountCents = rupeesToCents(amount);

  return (
    <Form
      ref={form}
      title={isEditing ? "Edit entry" : "New entry"}
      onSave={handleSave}
      canSave={!hydratingLink}
      saving={saving}
      dirty={dirty}
      footer={
        showKeyboard ? (
          <CustomKeyboard
            onKeyPress={(key) => {
              if (key === "Done") {
                const result = evaluateExpression();
                setAmount(result);
                setShowKeyboard(false);
                return;
              }
              const result: any = onKeyPress(key);
              setAmount(result);
            }}
          />
        ) : undefined
      }
    >
      <Pressable scale={false} accessibilityLabel="Amount" onPress={handleAmountTap} style={styles.amountHero}>
        <Text variant="callout" tone="muted" align="center" numberOfLines={1}>
          for {fund.name}
        </Text>
        {showKeyboard && expression ? (
          <Text variant="amountLarge" align="center" numberOfLines={1} adjustsFontSizeToFit style={styles.amount}>
            {expression}
          </Text>
        ) : (
          <Amount
            cents={amountCents}
            variant="display"
            tone={showKeyboard ? "accent" : amountCents > 0 ? "ink" : "subtle"}
            style={styles.amount}
          />
        )}
      </Pressable>

      <SegmentedControl
        value={direction}
        onChange={setDirection}
        options={[
          { key: "CONTRIBUTION", label: "Contribute" },
          { key: "WITHDRAWAL", label: "Withdraw" },
        ]}
        style={styles.segment}
      />

      <RowGroup>
        <Field
          icon="pencil-outline"
          placeholder="Add a note (optional)"
          value={note}
          onChangeText={setNote}
          onFocus={() => {
            setShowKeyboard(false);
            setShowDatePicker(false);
          }}
          returnKeyType="done"
        />
      </RowGroup>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.suggestions}
        contentContainerStyle={styles.suggestionsContent}
      >
        {SUGGESTIONS.map((s) => (
          <Pressable
            key={s}
            haptic="selection"
            onPress={() => setNote(s)}
            style={[styles.suggestion, { backgroundColor: COLORS.surface1 }]}
          >
            <Text variant="callout" tone={note === s ? "accent" : "muted"}>
              {s}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <RowGroup style={styles.group}>
        <ListRow
          icon="calendar-outline"
          title={formatDate(date)}
          chevron
          onPress={() => {
            dismissAll();
            setShowDatePicker(!showDatePicker);
          }}
        />
        {showDatePicker && (
          <View style={styles.datePicker}>
            <DateTimePicker
              value={date}
              mode="date"
              display="inline"
              onChange={handleDateChange}
              maximumDate={new Date()}
              themeVariant={isDark ? "dark" : "light"}
              accentColor={COLORS.accent}
              style={styles.datePickerInner}
            />
          </View>
        )}
      </RowGroup>

      <RowGroup inset={ICON_INSET} style={styles.group}>
        <ListRow
          icon="receipt"
          title={direction === "WITHDRAWAL" ? "Also record as income" : "Also add as a transaction"}
          onPress={() => setAddToTransaction(!addToTransaction)}
          trailing={
            <Switch value={addToTransaction} onValueChange={setAddToTransaction} trackColor={{ true: COLORS.accent }} />
          }
        />
        {addToTransaction && (
          <ListRow
            leading={
              selectedCategory ? (
                <GlyphPlate
                  name={selectedCategory.icon_name}
                  type={selectedCategory.icon_type}
                  color={colorForId(selectedCategory.id, COLORS.ordinal)}
                  size={34}
                  radius={10}
                />
              ) : undefined
            }
            icon="tag-outline"
            iconColor={COLORS.inkMuted}
            title={selectedCategory ? selectedCategory.name : "Category"}
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
            title={selectedBank?.name || (direction === "WITHDRAWAL" ? "Into which account?" : "From which account?")}
            placeholder={!selectedBank}
            chevron
            onPress={() => {
              dismissAll();
              accountSheetRef.current?.present();
            }}
          />
        )}
      </RowGroup>

      {isEditing && (
        <Button title="Delete entry" variant="destructive" onPress={handleDelete} style={styles.delete} />
      )}

      <CategoryBottomSheet ref={catSheetRef} categories={categories} onSelect={handleSelectCategory} />

      <Sheet ref={accountSheetRef} title="Account">
        {accounts.map((account) => (
          <ListRow
            key={account.id}
            padded={false}
            icon="wallet-outline"
            title={account.name}
            trailing={
              selectedBank?.id === account.id ? <Icon name="check" size="md" color={COLORS.accent} /> : undefined
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
  amountHero: { alignItems: "center", paddingTop: SPACE.md, paddingBottom: SPACE.xl },
  amount: { marginTop: SPACE.xs },
  segment: { marginBottom: SPACE.xl },
  group: { marginTop: SPACE.xl },
  suggestions: { marginTop: SPACE.md, marginHorizontal: -SPACE.gutter },
  suggestionsContent: { gap: SPACE.sm, paddingHorizontal: SPACE.gutter },
  suggestion: { borderRadius: RADIUS.pill, paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs + 2 },
  datePicker: { alignItems: "center", paddingBottom: SPACE.sm },
  datePickerInner: { height: 320 },
  delete: { marginTop: SPACE.xxl },
});

export default AddFundEntryScreen;

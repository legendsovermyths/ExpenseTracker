import React, { useRef, useState } from "react";
import { StyleSheet, View, Keyboard, Platform } from "react-native";
import { useRoute } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { RADIUS, SPACE } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import subscriptionFrequency from "../constants/subscriptionFrequency";
import {
  addAccount,
  updateAccount,
  deleteAccount,
} from "../services/AccountService";
import {
  CustomKeyboard,
  useCustomKeyboard,
} from "../components/CustomKeyboard";
import { useExpensifyStore } from "../store/store";
import { Account } from "../types/entity/Account";
import {
  Amount,
  Button,
  Field,
  Form,
  FormRef,
  Icon,
  ListRow,
  Pressable,
  RowGroup,
  SegmentedControl,
  Sheet,
  SheetRef,
  Text,
  confirm,
  haptic,
  hapticRhythm,
} from "../components/ui";
import { markChanged } from "../services/Feedback";

import { getCurrencySymbol } from "../constants/currency";
const BankInputScreen: React.FC = () => {
  const { COLORS, isDark } = useTheme();
  const route = useRoute<any>();
  const form = useRef<FormRef>(null);
  const frequencySheet = useRef<SheetRef>(null);
  const dateSheet = useRef<SheetRef>(null);

  const account: Account | undefined = route.params?.account;
  const mode: "add" | "edit" = route.params?.mode;

  const accountsById = useExpensifyStore((state) => state.accounts);
  const addAccountUI = useExpensifyStore((state) => state.addAccount);
  const updateAccountUI = useExpensifyStore((state) => state.updateAccounts);
  const deleteAccountUI = useExpensifyStore((state) => state.deleteAccount);
  const accounts = Object.values(accountsById);

  const { expression, onKeyPress, evaluateExpression } = useCustomKeyboard(
    account?.amount?.toString() || "",
  );

  const [amount, setAmount] = useState(account?.amount?.toString() || "0");
  const [name, setName] = useState(account?.name || "");
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState(
    account?.is_credit ? 1 : 0,
  );
  const [date, setDate] = useState(
    account?.due_date ? new Date(account.due_date) : new Date(),
  );
  const [showAndroidDatePicker, setShowAndroidDatePicker] = useState(false);
  const [selectedFrequency, setSelectedFrequency] = useState<string | null>(
    account?.frequency || null,
  );
  const [error, setError] = useState("");

  const initial = useRef({
    amount,
    name,
    credit: selectedCredit,
    date: date.getTime(),
    frequency: selectedFrequency,
  }).current;
  const dirty =
    (amount || "0") !== (initial.amount || "0") ||
    name !== initial.name ||
    selectedCredit !== initial.credit ||
    date.getTime() !== initial.date ||
    selectedFrequency !== initial.frequency;

  const dismissAll = () => {
    if (showKeyboard) {
      const result = evaluateExpression();
      setAmount(result);
    }
    setShowKeyboard(false);
    setShowAndroidDatePicker(false);
    frequencySheet.current?.dismiss();
    dateSheet.current?.dismiss();
    Keyboard.dismiss();
  };

  const handleAmountTap = () => {
    dismissAll();
    setShowKeyboard(true);
  };

  const makeAccountObject = (): Partial<Account> => ({
    id: account?.id || undefined,
    name: name.toUpperCase(),
    amount: Number(amount),
    is_credit: Boolean(selectedCredit),
    date_time: account?.date_time || new Date().toISOString(),
    due_date: selectedFrequency ? date.toISOString() : null,
    theme: account?.theme || "Deep",
    frequency: selectedFrequency,
    is_deleted: false,
  });

  const handleSave = async () => {
    if (!name.trim() || !amount.trim()) {
      setError("Name and amount are required");
      return;
    }
    const upperName = name.toUpperCase();
    const duplicate = accounts.find(
      (a) => a.name === upperName && a.id !== account?.id,
    );
    if (duplicate) {
      setError("An account with this name already exists");
      return;
    }
    const obj = makeAccountObject();
    if (mode === "edit") {
      const updated = await updateAccount(obj as Account);
      updateAccountUI(updated);
      markChanged("account", [updated.id], "edited");
    } else {
      const added = await addAccount(obj as Account);
      addAccountUI(added);
      markChanged("account", [added.id], "added");
    }
    hapticRhythm("saveLanded");
    form.current?.close();
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete ${account?.name}?`,
      message: "Its transactions stay, but won't be linked to this account.",
    });
    if (!ok) return;
    await deleteAccount(account!);
    deleteAccountUI(account!.id);
    haptic("light");
    form.current?.close();
  };

  const handleDateChange = (_: any, selectedDate?: Date) => {
    setShowAndroidDatePicker(false);
    dateSheet.current?.dismiss();
    if (!selectedDate) return;
    setDate(selectedDate);
  };

  const openDatePicker = () => {
    dismissAll();
    if (Platform.OS === "ios") dateSheet.current?.present();
    else setShowAndroidDatePicker(true);
  };

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const amountNum = parseFloat(amount) || 0;
  const typing = showKeyboard && !!expression;
  const hasOperator = /[+\-*/()]/.test(expression.replace(/^-/, ""));

  return (
    <Form
      ref={form}
      title={mode === "edit" ? "Edit account" : "New account"}
      onSave={handleSave}
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
              const result = onKeyPress(key);
              setAmount(String(result));
            }}
          />
        ) : undefined
      }
    >
      <SegmentedControl
        value={selectedCredit ? "credit" : "debit"}
        onChange={(k) => {
          setSelectedCredit(k === "credit" ? 1 : 0);
          dismissAll();
        }}
        options={[
          { key: "debit", label: "Debit" },
          { key: "credit", label: "Credit" },
        ]}
      />

      <Pressable
        onPress={handleAmountTap}
        scale={false}
        accessibilityLabel="Balance"
        style={styles.amount}
      >
        <Text variant="callout" tone="muted">
          {selectedCredit ? "Outstanding" : "Balance"}
        </Text>
        {typing ? (
          <Text
            variant={hasOperator ? "amountLarge" : "display"}
            align="center"
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {hasOperator ? expression : `${getCurrencySymbol()}${expression}`}
          </Text>
        ) : (
          <Amount
            cents={Math.round(Math.abs(amountNum) * 100)}
            variant="display"
            tone={amountNum < 0 ? "up" : amountNum === 0 ? "subtle" : "ink"}
          />
        )}
        <View
          style={[
            styles.caret,
            { backgroundColor: showKeyboard ? COLORS.accent : "transparent" },
          ]}
        />
      </Pressable>

      <RowGroup>
        <Field
          label="Name"
          placeholder="e.g. HDFC SAVINGS"
          value={name}
          onChangeText={(t) => {
            setName(t);
            if (error) setError("");
          }}
          autoCapitalize="characters"
          onFocus={() => {
            if (showKeyboard) {
              const result = evaluateExpression();
              setAmount(result);
            }
            setShowKeyboard(false);
          }}
          returnKeyType="done"
          error={error || null}
        />
      </RowGroup>

      {selectedCredit === 1 && (
        <RowGroup inset={SPACE.lg + 34 + SPACE.md} style={styles.group}>
          <ListRow
            icon="refresh"
            title="Invoice frequency"
            value={selectedFrequency ?? "None"}
            valueTone={selectedFrequency ? "ink" : "subtle"}
            chevron
            onPress={() => {
              dismissAll();
              frequencySheet.current?.present();
            }}
          />
          <ListRow
            icon="calendar-clock"
            title="Next invoice"
            value={formatDate(date)}
            chevron
            onPress={openDatePicker}
          />
        </RowGroup>
      )}

      {mode === "edit" && (
        <Button
          title="Delete account"
          variant="destructive"
          onPress={handleDelete}
          style={styles.delete}
        />
      )}

      {showAndroidDatePicker && (
        <DateTimePicker value={date} mode="date" onChange={handleDateChange} />
      )}

      <Sheet
        ref={frequencySheet}
        title="Invoice frequency"
        snapPoints={["60%"]}
      >
        {subscriptionFrequency.map((freq) => {
          const active = selectedFrequency === freq;
          return (
            <ListRow
              key={freq}
              padded={false}
              dense
              title={freq}
              trailing={
                active ? (
                  <Icon name="check" size="md" color={COLORS.accent} />
                ) : undefined
              }
              onPress={() => {
                setSelectedFrequency(freq);
                frequencySheet.current?.dismiss();
              }}
            />
          );
        })}
      </Sheet>

      {Platform.OS === "ios" && (
        <Sheet ref={dateSheet} title="Next invoice">
          <DateTimePicker
            value={date}
            mode="date"
            display="inline"
            onChange={handleDateChange}
            themeVariant={isDark ? "dark" : "light"}
            accentColor={COLORS.accent}
            style={styles.datePicker}
          />
        </Sheet>
      )}
    </Form>
  );
};

const styles = StyleSheet.create({
  amount: {
    alignItems: "center",
    gap: SPACE.xs,
    paddingTop: SPACE.xl,
    paddingBottom: SPACE.xl,
  },
  caret: { width: 24, height: 2, borderRadius: RADIUS.pill },
  group: { marginTop: SPACE.lg },
  delete: { marginTop: SPACE.xl, alignSelf: "center" },
  datePicker: { alignSelf: "center" },
});

export default BankInputScreen;

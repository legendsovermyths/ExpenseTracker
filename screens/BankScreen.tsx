import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SPACE } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { useExpensifyStore } from "../store/store";
import { deleteAccount } from "../services/AccountService";
import { formatISODateToLocalDate, getMonthRange } from "../services/Utils";
import { Account } from "../types/entity/Account";
import {
  Amount,
  EmptyState,
  GlyphPlate,
  HeaderIconButton,
  Page,
  Pressable,
  SectionLabel,
  Stat,
  StatStrip,
  Text,
  confirm,
  formatMoney,
  haptic,
  FeedbackRow,
} from "../components/ui";

const PLATE = 40;
const cents = (rupees: number) => Math.round(rupees * 100);

const BankScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const navigation = useNavigation<any>();
  const accountsById = useExpensifyStore((state) => state.accounts);
  const transactionsById = useExpensifyStore((state) => state.transactions);
  const deleteAccountUI = useExpensifyStore((state) => state.deleteAccount);
  const transactions = Object.values(transactionsById);
  const accounts = Object.values(accountsById).filter((a) => !a.is_deleted);

  // Current month transactions per account
  const now = new Date();
  const { firstDate, lastDate } = getMonthRange(
    now.getFullYear(),
    now.getMonth(),
  );

  const monthlyStats = useMemo(() => {
    const stats: Record<
      number,
      { txCount: number; spent: number; income: number }
    > = {};
    accounts.forEach((a) => {
      stats[a.id] = { txCount: 0, spent: 0, income: 0 };
    });
    transactions.forEach((t) => {
      const txDate = new Date(t.date_time);
      if (txDate >= firstDate && txDate <= lastDate && stats[t.account_id]) {
        stats[t.account_id].txCount++;
        if (t.is_credit) stats[t.account_id].income += t.amount;
        else stats[t.account_id].spent += t.amount;
      }
    });
    return stats;
  }, [transactions, accounts, firstDate, lastDate]);

  // Totals
  const totalBalance = accounts.reduce(
    (acc, a) => acc + (a.is_credit ? -a.amount : a.amount),
    0,
  );
  const totalDebit = accounts
    .filter((a) => !a.is_credit)
    .reduce((acc, a) => acc + a.amount, 0);
  const totalCredit = accounts
    .filter((a) => a.is_credit)
    .reduce((acc, a) => acc + a.amount, 0);
  const hasDebit = accounts.some((a) => !a.is_credit);
  const hasCredit = accounts.some((a) => a.is_credit);

  const handleDelete = async (account: Account) => {
    const ok = await confirm({
      title: `Delete ${account.name}?`,
      message: "Its transactions stay, but won't be linked to this account.",
    });
    if (!ok) return;
    await deleteAccount(account);
    deleteAccountUI(account.id);
    haptic("light");
  };

  const handleEdit = (account: Account) => {
    navigation.navigate("AddBank", { account, mode: "edit" });
  };

  const handleAdd = () => {
    navigation.navigate("AddBank", { mode: "add" });
  };

  return (
    <Page
      title="Accounts"
      right={
        <HeaderIconButton icon="plus" label="Add account" onPress={handleAdd} />
      }
    >
      {accounts.length === 0 ? (
        <EmptyState
          icon="wallet-plus-outline"
          title="No accounts yet"
          message="Add a bank account or credit card to start tracking where money moves."
          actionLabel="Add account"
          onAction={handleAdd}
        />
      ) : (
        <>
          <View style={styles.net}>
            <Text variant="callout" tone="muted">
              Net balance
            </Text>
            <Amount
              cents={cents(Math.abs(totalBalance))}
              variant="display"
              tone={totalBalance >= 0 ? "ink" : "up"}
            />
          </View>

          {hasDebit && hasCredit && (
            <StatStrip>
              <Stat
                value={
                  <Amount
                    cents={cents(Math.abs(totalDebit))}
                    variant="amount"
                    tone="down"
                  />
                }
                label="in debit accounts"
              />
              <Stat
                value={
                  <Amount
                    cents={cents(Math.abs(totalCredit))}
                    variant="amount"
                    tone="up"
                  />
                }
                label="on credit cards"
              />
            </StatStrip>
          )}

          <SectionLabel title="This month" />
          {accounts.map((account, i) => {
            const stats = monthlyStats[account.id];
            const txCount = stats?.txCount || 0;
            const meta = [
              account.is_credit ? "Credit card" : "Debit",
              account.is_credit && account.frequency ? account.frequency : null,
              account.is_credit && account.due_date
                ? `due ${formatISODateToLocalDate(account.due_date)}`
                : null,
            ].filter(Boolean);
            const activity =
              txCount === 0
                ? "No activity"
                : [
                    `${txCount} ${txCount === 1 ? "transaction" : "transactions"}`,
                    stats.spent > 0
                      ? `${formatMoney(cents(stats.spent))} out`
                      : null,
                    stats.income > 0
                      ? `${formatMoney(cents(stats.income))} in`
                      : null,
                  ]
                    .filter(Boolean)
                    .join("  ·  ");

            return (
              <FeedbackRow key={account.id} kind="account" id={account.id}>
                <Pressable
                  scale={false}
                  onPress={() => handleEdit(account)}
                  onLongPress={() => handleDelete(account)}
                  accessibilityLabel={account.name}
                  accessibilityHint="Long press to delete"
                  style={[
                    styles.row,
                    i > 0 && {
                      borderTopColor: COLORS.hairline,
                      borderTopWidth: StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <GlyphPlate
                    name={
                      account.is_credit
                        ? "credit-card-outline"
                        : "wallet-outline"
                    }
                    color={
                      account.is_credit ? COLORS.accentWarm : COLORS.accent
                    }
                    size={PLATE}
                    radius={12}
                  />
                  <View style={styles.body}>
                    <View style={styles.titleRow}>
                      <Text
                        variant="headline"
                        numberOfLines={1}
                        style={styles.name}
                      >
                        {account.name}
                      </Text>
                      <Amount
                        cents={cents(Math.abs(account.amount))}
                        variant="amount"
                        tone={account.amount >= 0 ? "ink" : "up"}
                      />
                    </View>
                    <Text variant="callout" tone="muted" numberOfLines={1}>
                      {meta.join("  ·  ")}
                    </Text>
                    <Text
                      variant="caption"
                      tone="subtle"
                      numberOfLines={1}
                      style={styles.activity}
                    >
                      {activity}
                    </Text>
                  </View>
                </Pressable>
              </FeedbackRow>
            );
          })}
        </>
      )}
    </Page>
  );
};

const styles = StyleSheet.create({
  net: { gap: SPACE.xs, paddingBottom: SPACE.lg },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.md,
    paddingVertical: SPACE.lg,
  },
  body: { flex: 1, minWidth: 0 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    marginBottom: 2,
  },
  name: { flex: 1 },
  activity: { marginTop: SPACE.xs },
});

export default BankScreen;

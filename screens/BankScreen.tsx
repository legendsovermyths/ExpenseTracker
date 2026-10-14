import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { FONTS, SIZES } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";
import { Icon } from "react-native-elements";
import { useExpensifyStore } from "../store/store";
import {
  deleteAccount,
} from "../services/AccountService";
import {
  formatISODateToLocalDate,
  formatAmountWithCommas,
  getMonthRange,
} from "../services/Utils";
import { useNavigation } from "@react-navigation/native";
import { Account } from "../types/entity/Account";

const BankScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const navigation = useNavigation<any>();
  const accountsById = useExpensifyStore((state) => state.accounts);
  const transactionsById = useExpensifyStore((state) => state.transactions);
  const deleteAccountUI = useExpensifyStore((state) => state.deleteAccount);
  const transactions = Object.values(transactionsById);
  const accounts = Object.values(accountsById).filter((a) => !a.is_deleted);

  // Current month transactions per account
  const now = new Date();
  const { firstDate, lastDate } = getMonthRange(now.getFullYear(), now.getMonth());

  const monthlyStats = useMemo(() => {
    const stats: Record<number, { txCount: number; spent: number; income: number }> = {};
    accounts.forEach((a) => { stats[a.id] = { txCount: 0, spent: 0, income: 0 }; });
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
  const totalBalance = accounts.reduce((acc, a) => acc + (a.is_credit ? -a.amount : a.amount), 0);
  const totalDebit = accounts.filter((a) => !a.is_credit).reduce((acc, a) => acc + a.amount, 0);
  const totalCredit = accounts.filter((a) => a.is_credit).reduce((acc, a) => acc + a.amount, 0);

  const handleDelete = async (account: Account) => {
    Alert.alert(
      `Delete ${account.name}`,
      "Are you sure? All transactions will remain but won't be linked to this account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteAccount(account);
            deleteAccountUI(account.id);
          },
        },
      ],
    );
  };

  const handleEdit = (account: Account) => {
    navigation.navigate("AddBank", { account, mode: "edit" });
  };

  const handleAdd = () => {
    navigation.navigate("AddBank", { mode: "add" });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" type="material-community" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Accounts</Text>
        <TouchableOpacity onPress={handleAdd} style={styles.addButton}>
          <Icon name="plus" type="material-community" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Summary */}
        {accounts.length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Net Balance</Text>
            <Text style={[styles.summaryAmount, { color: totalBalance >= 0 ? COLORS.primary : COLORS.red2 }]}>
              ₹{formatAmountWithCommas(Math.abs(totalBalance), false)}
            </Text>
            <View style={styles.summaryRow}>
              {accounts.filter((a) => !a.is_credit).length > 0 && (
                <View style={styles.summaryStat}>
                  <View style={[styles.summaryDot, { backgroundColor: COLORS.darkgreen }]} />
                  <Text style={styles.summaryStatLabel}>Debit</Text>
                  <Text style={[styles.summaryStatValue, { color: COLORS.darkgreen }]}>
                    ₹{formatAmountWithCommas(Math.abs(totalDebit), false)}
                  </Text>
                </View>
              )}
              {accounts.filter((a) => a.is_credit).length > 0 && (
                <>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryStat}>
                    <View style={[styles.summaryDot, { backgroundColor: COLORS.red2 }]} />
                    <Text style={styles.summaryStatLabel}>Credit</Text>
                    <Text style={[styles.summaryStatValue, { color: COLORS.red2 }]}>
                      ₹{formatAmountWithCommas(Math.abs(totalCredit), false)}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {/* Account list */}
        {accounts.map((account) => {
          const stats = monthlyStats[account.id];
          const txCount = stats?.txCount || 0;
          const expenditure = stats?.spent || 0;
          const income = stats?.income || 0;

          return (
            <TouchableOpacity
              key={account.id}
              style={styles.accountCard}
              activeOpacity={0.7}
              onPress={() => handleEdit(account)}
              onLongPress={() => handleDelete(account)}
            >
              {/* Top row: icon, name, type */}
              <View style={styles.accountHeader}>
                <View style={[styles.accountIcon, { backgroundColor: account.is_credit ? COLORS.purple + "15" : COLORS.blue + "15" }]}>
                  <Icon
                    name={account.is_credit ? "credit-card-outline" : "wallet-outline"}
                    type="material-community"
                    size={20}
                    color={account.is_credit ? COLORS.purple : COLORS.blue}
                  />
                </View>
                <View style={styles.accountInfo}>
                  <Text style={styles.accountName}>{account.name}</Text>
                  <Text style={styles.accountType}>
                    {account.is_credit ? "Credit" : "Debit"}
                    {account.is_credit && account.frequency ? ` · ${account.frequency}` : ""}
                  </Text>
                </View>
              </View>

              {/* Balance */}
              <Text style={[styles.accountBalance, { color: account.amount >= 0 ? COLORS.primary : COLORS.red2 }]}>
                ₹{formatAmountWithCommas(Math.abs(account.amount), false)}
              </Text>

              {/* Stats row */}
              <Text style={styles.statsLabel}>This month</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{txCount}</Text>
                  <Text style={styles.statLabel}>Transactions</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: COLORS.red2 }]}>
                    ₹{formatAmountWithCommas(expenditure, false)}
                  </Text>
                  <Text style={styles.statLabel}>Spent</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: COLORS.darkgreen }]}>
                    ₹{formatAmountWithCommas(income, false)}
                  </Text>
                  <Text style={styles.statLabel}>Income</Text>
                </View>
              </View>

              {/* Credit card extra info */}
              {account.is_credit && account.due_date && (
                <View style={styles.dueRow}>
                  <Icon name="calendar-clock" type="material-community" size={14} color={COLORS.darkgray} />
                  <Text style={styles.dueText}>
                    Next invoice: {formatISODateToLocalDate(account.due_date)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {/* Empty state */}
        {accounts.length === 0 && (
          <View style={styles.emptyState}>
            <Icon name="wallet-plus-outline" type="material-community" size={48} color={COLORS.gray} />
            <Text style={styles.emptyTitle}>No accounts yet</Text>
            <Text style={styles.emptyText}>Add a bank or credit card to get started</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={handleAdd}>
              <Icon name="plus" type="material-community" size={20} color={COLORS.white} />
              <Text style={styles.emptyButtonText}>Add Account</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.white,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: SIZES.padding,
      paddingTop: SIZES.padding * 2.5,
      paddingBottom: SIZES.base,
    },
    backButton: {
      padding: 4,
    },
    headerTitle: {
      ...FONTS.h2,
      color: COLORS.primary,
      fontWeight: "700",
    },
    addButton: {
      padding: 4,
    },
    scrollContent: {
      paddingHorizontal: SIZES.padding,
    },

    // Summary
    summaryCard: {
      backgroundColor: COLORS.lightGray,
      borderRadius: 16,
      padding: SIZES.padding,
      marginBottom: SIZES.padding,
    },
    summaryLabel: {
      ...FONTS.body4,
      color: COLORS.darkgray,
      fontWeight: "500",
    },
    summaryAmount: {
      ...FONTS.h1,
      fontSize: 30,
      fontWeight: "800",
      letterSpacing: -1,
      marginTop: 4,
      marginBottom: SIZES.base + 4,
    },
    summaryRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    summaryStat: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    summaryDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    summaryStatLabel: {
      ...FONTS.body4,
      fontSize: 12,
      color: COLORS.darkgray,
    },
    summaryStatValue: {
      ...FONTS.body3,
      fontWeight: "600",
    },
    summaryDivider: {
      width: 1,
      height: 20,
      backgroundColor: COLORS.gray,
      marginHorizontal: SIZES.base,
      opacity: 0.3,
    },

    // Account cards
    accountCard: {
      backgroundColor: COLORS.lightGray,
      borderRadius: 14,
      padding: SIZES.padding * 0.8,
      marginBottom: SIZES.base + 4,
    },
    accountHeader: {
      flexDirection: "row",
      alignItems: "center",
    },
    accountIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    accountInfo: {
      flex: 1,
      marginLeft: SIZES.base + 2,
    },
    accountName: {
      ...FONTS.body3,
      fontWeight: "600",
      color: COLORS.primary,
    },
    accountType: {
      ...FONTS.body4,
      fontSize: 12,
      color: COLORS.darkgray,
      marginTop: 1,
    },
    accountBalance: {
      ...FONTS.h2,
      fontWeight: "800",
      letterSpacing: -0.5,
      marginTop: SIZES.base + 4,
    },

    // Stats row
    statsLabel: {
      ...FONTS.body4,
      fontSize: 11,
      color: COLORS.darkgray,
      marginTop: SIZES.base + 4,
      marginBottom: 6,
    },
    statsRow: {
      flexDirection: "row",
      backgroundColor: COLORS.white,
      borderRadius: 10,
      paddingVertical: SIZES.base + 2,
    },
    statItem: {
      flex: 1,
      alignItems: "center",
    },
    statValue: {
      ...FONTS.body4,
      fontSize: 13,
      fontWeight: "600",
      color: COLORS.primary,
    },
    statLabel: {
      ...FONTS.body4,
      fontSize: 10,
      color: COLORS.darkgray,
      marginTop: 2,
    },

    // Due date
    dueRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: SIZES.base + 2,
      paddingTop: SIZES.base + 2,
      borderTopWidth: 1,
      borderTopColor: COLORS.white,
    },
    dueText: {
      ...FONTS.body4,
      fontSize: 12,
      color: COLORS.darkgray,
    },

    // Empty
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: SIZES.padding * 4,
      gap: SIZES.base,
    },
    emptyTitle: {
      ...FONTS.h3,
      color: COLORS.primary,
      fontWeight: "700",
    },
    emptyText: {
      ...FONTS.body3,
      color: COLORS.darkgray,
    },
    emptyButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: COLORS.primary,
      paddingHorizontal: SIZES.padding,
      paddingVertical: SIZES.base + 2,
      borderRadius: 12,
      marginTop: SIZES.base,
    },
    emptyButtonText: {
      ...FONTS.body3,
      color: COLORS.white,
      fontWeight: "600",
    },
  });

export default BankScreen;

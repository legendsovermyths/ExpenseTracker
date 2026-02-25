import React, { useMemo } from "react";
import {
  SectionList,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { FONTS, SIZES } from "../constants";
import { formatAmountWithCommas, getFormattedDate, getLocalDateFromISO } from "../services/Utils";
import { useNavigation } from "@react-navigation/native";
import TransactionCard from "./TransactionCard";
import { Transaction } from "../types/entity/Transaction";
import { useTheme } from "../contexts/ThemeContext";

interface TransactionListProps {
  currentMonthTransactions: Transaction[];
}

interface TransactionSection {
  title: string;
  data: Transaction[];
}

const TransactionsList: React.FC<TransactionListProps> = ({
  currentMonthTransactions,
}) => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const navigation = useNavigation<any>();

  const handleEdit = (transaction: Transaction) => {
    navigation.navigate("TransactionEdit", {
      transaction: transaction,
      mode: "edit",
    });
  };

  const renderTransactionItem = (item: Transaction) => (
    <TouchableOpacity onPress={() => handleEdit(item)} activeOpacity={0.7}>
      <View style={styles.transactionItem}>
        <TransactionCard item={item} />
      </View>
    </TouchableOpacity>
  );

  const renderTransferItem = (item: Transaction) => (
    <TouchableOpacity onPress={() => handleEdit(item)} activeOpacity={0.7}>
      <View style={styles.transferItem}>
        <View style={styles.transferContent}>
          <View style={styles.transferRow}>
            <Text style={styles.transferText}>
              <Text style={styles.transferAmountOut}>
                {"↓"}₹{formatAmountWithCommas(Math.abs(item.amount))}
              </Text>
              {"  "}{item.description || "Transfer"}
            </Text>
            <Text style={styles.transferArrow}>⟶</Text>
            <Text style={styles.transferText}>
              {item.description || "Transfer"}{" "}
              <Text style={styles.transferAmountIn}>
                {item.amount < 0 ? "↓" : "↑"}₹
                {formatAmountWithCommas(Math.abs(item.amount))}
              </Text>
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const sections: TransactionSection[] = currentMonthTransactions.reduce(
    (acc: TransactionSection[], transaction) => {
      const dateTitle = getLocalDateFromISO(transaction.date_time);
      if (!dateTitle) return acc;

      const existingSection = acc.find(
        (section) => section.title === dateTitle
      );

      if (existingSection) {
        existingSection.data.push(transaction);
      } else {
        acc.push({
          title: dateTitle,
          data: [transaction],
        });
      }

      return acc;
    },
    []
  );

  return (
    <SectionList
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
      sections={sections}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) =>
        item.type === "transfer"
          ? renderTransferItem(item)
          : renderTransactionItem(item)
      }
      renderSectionHeader={({ section: { title } }) => (
        <TouchableOpacity
          onPress={() => {
            const date = new Date(title);
            navigation.navigate("TransactionEdit", {
              transaction: { date_time: date.toISOString() },
              mode: "add",
            });
          }}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionLine} />
            <Text style={styles.sectionTitle}>{getFormattedDate(title)}</Text>
            <View style={styles.sectionLineRight} />
          </View>
        </TouchableOpacity>
      )}
      stickySectionHeadersEnabled={true}
      ListEmptyComponent={() => (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No transactions this month</Text>
          <Text style={styles.emptySubtext}>Tap + to add your first transaction</Text>
        </View>
      )}
    />
  );
};

const createStyles = (COLORS: any) => StyleSheet.create({
  listContent: {
    paddingHorizontal: SIZES.padding,
    paddingBottom: SIZES.padding * 8,
  },
  transactionItem: {
    paddingVertical: SIZES.base / 2,
  },
  transferItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SIZES.padding / 4,
  },
  transferContent: {
    flex: 1,
    alignItems: "center",
  },
  transferRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  transferText: {
    color: COLORS.primary,
    marginTop: 2,
    ...FONTS.body4,
  },
  transferAmountOut: {
    color: COLORS.red2,
    ...FONTS.body4,
  },
  transferAmountIn: {
    color: COLORS.darkgreen,
    ...FONTS.body4,
  },
  transferArrow: {
    color: COLORS.primary,
    fontSize: 30,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: SIZES.base,
    paddingBottom: SIZES.base / 2,
    backgroundColor: COLORS.white,
  },
  sectionLine: {
    width: 8,
    height: 1,
    backgroundColor: COLORS.lightGray,
    marginRight: SIZES.base,
  },
  sectionLineRight: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.lightGray,
    marginLeft: SIZES.base,
  },
  sectionTitle: {
    color: COLORS.darkgray,
    ...FONTS.body4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: SIZES.padding * 4,
  },
  emptyText: {
    ...FONTS.h3,
    color: COLORS.darkgray,
    marginBottom: SIZES.base,
  },
  emptySubtext: {
    ...FONTS.body4,
    color: COLORS.gray,
  },
});

export default TransactionsList;

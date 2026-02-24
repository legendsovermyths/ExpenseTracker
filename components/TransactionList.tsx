import React from "react";
import {
  SectionList,
  View,
  Text,
  TouchableOpacity,
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
  const navigation = useNavigation<any>();

  const handleEdit = (transaction: Transaction) => {
    navigation.navigate("TransactionEdit", {
      transaction: transaction,
      mode: "edit",
    });
  };

  const renderTransactionItem = (item: Transaction) => (
    <TouchableOpacity onPress={() => handleEdit(item)} activeOpacity={1}>
      <View style={{ paddingVertical: 5 }}>
        <TransactionCard item={item} />
      </View>
    </TouchableOpacity>
  );

  const renderTransferItem = (item: Transaction) => (
    <TouchableOpacity onPress={() => handleEdit(item)} activeOpacity={1}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: SIZES.padding / 4,
        }}
      >
        <View style={{ flex: 1, alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ color: COLORS.primary, marginTop: 2, ...FONTS.body4 }}>
              <Text style={{ color: COLORS.red2, ...FONTS.body4 }}>
                {"↓"}₹{formatAmountWithCommas(Math.abs(item.amount))}
              </Text>
              {"  "}{item.description || "Transfer"}
            </Text>
            <Text style={{ color: COLORS.primary, fontSize: 30 }}>⟶</Text>
            <Text style={{ color: COLORS.primary, marginTop: 2, ...FONTS.body4 }}>
              {item.description || "Transfer"}{" "}
              <Text style={{ color: COLORS.darkgreen, ...FONTS.body4 }}>
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
      contentContainerStyle={{ paddingBottom: SIZES.padding * 8 }}
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
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingTop: SIZES.padding / 4,
              backgroundColor: COLORS.white,
            }}
          >
            <View
              style={{
                flex: 0.01,
                height: 1,
                backgroundColor: COLORS.lightGray,
              }}
            />
            <Text style={{ color: COLORS.darkgray }}>
              {getFormattedDate(title)}
            </Text>
            <View
              style={{
                flex: 0.5,
                height: 1,
                backgroundColor: COLORS.lightGray,
              }}
            />
          </View>
        </TouchableOpacity>
      )}
      stickySectionHeadersEnabled={true}
    />
  );
};

export default TransactionsList;

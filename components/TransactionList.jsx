import React from "react";
import {
  SectionList,
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
} from "react-native";
import { COLORS, FONTS, SIZES, icons, images } from "../constants";
import { formatAmountWithCommas } from "../services/Utils";
import { useNavigation } from "@react-navigation/native";
import TransactionCard from "./TransactionCard";
import { format } from "date-fns";
import { useExpensifyStore } from "../store/store";

const getLocalDateFromISO = (isoString) => {
  if (!isoString) return null;
  return format(new Date(isoString), "yyyy-MM-dd");
};

const getFormattedDate = (date) => {
  const today = new Date();
  const transactionDate = new Date(date);
  if (transactionDate.toDateString() === today.toDateString()) {
    return "Today";
  } else {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (transactionDate.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      const day = transactionDate.getDate();
      const monthIndex = transactionDate.getMonth();
      const month = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ][monthIndex];

      const suffix = (day) => {
        if (day === 1 || day === 21 || day === 31) return "st";
        if (day === 2 || day === 22) return "nd";
        if (day === 3 || day === 23) return "rd";
        return "th";
      };

      return `${day}${suffix(day)} ${month}`;
    }
  }
};

const TransactionsList = ({ currentMonthTransactions }) => {
  const navigation = useNavigation();
  const handleEdit = (transaction) => {
    navigation.navigate("TransactionEdit", {
      transaction: transaction,
      mode: "edit",
    });
  };

  const renderTransactionItem = (item) => (
    <TouchableOpacity onPress={() => handleEdit(item)} activeOpacity={1}>
      <View style={{ paddingVertical: 5 }}>
        <TransactionCard item={item} />
      </View>
    </TouchableOpacity>
  );

  const renderTransferItem = (item) => (
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
            <Text
              style={{ color: COLORS.primary, marginTop: 2, ...FONTS.body4 }}
            >
              <Text style={{ color: COLORS.red2, ...FONTS.body4 }}>
                {"↓"}₹{formatAmountWithCommas(Math.abs(item.amount))}
              </Text>
              {"  " + item.from_bank}
            </Text>
            <Text style={{ color: COLORS.primary, fontSize: 30 }}>⟶</Text>
            <Text
              style={{ color: COLORS.primary, marginTop: 2, ...FONTS.body4 }}
            >
              {item.to_bank}{" "}
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

  return (
    <SectionList
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: SIZES.padding * 8 }}
      sections={currentMonthTransactions.reduce((acc, transaction) => {
        const existingSection = acc.find(
          (section) =>
            section.title === getLocalDateFromISO(transaction.date_time),
        );
        if (existingSection) {
          existingSection.data.push(transaction);
        } else {
          acc.push({
            title: getLocalDateFromISO(transaction.date_time),
            data: [transaction],
          });
        }
        return acc;
      }, [])}
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

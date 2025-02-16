import React from "react";
import { SectionList, View, Text, ScrollView, Image } from "react-native";
import { COLORS, FONTS, SIZES, icons, images } from "../constants";
import { formatAmountWithCommas } from "../services/Utils";
import { ListItem, Button } from "@rneui/themed";
import { useNavigation } from "@react-navigation/native";
import { deleteTransactionWithId } from "../services/TransactionService";
import { Icon } from "react-native-elements";
import { invokeBackend } from "../services/api";
import { Action } from "../types/actions/actions";
import TransactionCard from "./TransactionCard";
import { format } from "date-fns";
import { deleteTransaction } from "../services/_TransactionService";
import { useExpensifyStore } from "../store/store";

const getLocalDateFromISO = (isoString) => {
  if (!isoString) return null;
  return format(new Date(isoString), "yyyy-MM-dd"); // Adjust format if needed
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
  const deleteTransactionFromUI = useExpensifyStore((state)=>state.deleteTransaction);
  const handleDeletion = async (reset, transaction) => {
    try{
     await deleteTransaction(transaction);
      deleteTransactionFromUI(transaction.id); 
      reset();
    } catch (error) {
      console.error("Error deleting transaction:", error);
    }
  };
  const handleEdit = (reset, transaction) => {
    reset();
    navigation.navigate("TransactionEdit", { transaction: transaction });
  };

  const renderTransactionItem = (item) => (
    <ListItem.Swipeable
      containerStyle={{ padding: 0 }}
      leftContent={(reset) => (
        <Button
          title="Edit"
          onPress={() => handleEdit(reset, item)}
          icon={{ name: "edit", color: "white" }}
          buttonStyle={{ minHeight: "100%", marginRight: 10 }}
        />
      )}
      rightContent={(reset) => (
        <Button
          title="Delete"
          onPress={() => handleDeletion(reset, item)}
          icon={{ name: "delete", color: "white" }}
          buttonStyle={{
            minHeight: "100%",
            backgroundColor: COLORS.red,
            marginLeft: 10,
          }}
        />
      )}
    >
      <ListItem.Content>
        <TransactionCard item={item}/>
      </ListItem.Content>
    </ListItem.Swipeable>
  );

  const renderTransferItem = (item) => (
    <ListItem.Swipeable
      containerStyle={{ padding: 0 }}
      leftContent={(reset) => (
        <Button
          title="Edit"
          onPress={() => handleEdit(reset, item)}
          icon={{ name: "edit", color: "white" }}
          buttonStyle={{ minHeight: "100%", marginRight: 10 }}
        />
      )}
      rightContent={(reset) => (
        <Button
          title="Delete"
          onPress={() => handDeletion(reset, item.id)}
          icon={{ name: "delete", color: "white" }}
          buttonStyle={{
            minHeight: "100%",
            backgroundColor: COLORS.red,
            marginLeft: 10,
          }}
        />
      )}
    >
      <ListItem.Content>
        <View
          key={item.id}
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
      </ListItem.Content>
    </ListItem.Swipeable>
  );

  return (
    <SectionList
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: SIZES.padding * 8 }}
      sections={currentMonthTransactions.reduce((acc, transaction) => {
        const existingSection = acc.find(
          (section) => section.title === getLocalDateFromISO(transaction.date_time),
        );
        if (existingSection) {
          existingSection.data.push(transaction);
        } else {
          acc.push({ title: getLocalDateFromISO(transaction.date_time), data: [transaction] });
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
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingTop: SIZES.padding / 4,
            backgroundColor: COLORS.white,
          }}
        >
          <View
            style={{ flex: 0.01, height: 1, backgroundColor: COLORS.lightGray }}
          />
          <Text style={{ color: COLORS.darkgray }}>
            {getFormattedDate(title)}
          </Text>
          <View
            style={{ flex: 0.5, height: 1, backgroundColor: COLORS.lightGray }}
          />
        </View>
      )}
      stickySectionHeadersEnabled={true}
    />
  );
};

export default TransactionsList;

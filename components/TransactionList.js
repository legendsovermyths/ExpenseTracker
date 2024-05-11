import React, { useContext } from "react";
import { SectionList, View, Text, ScrollView, Image } from "react-native";
import { COLORS, FONTS, SIZES, icons, images } from "../constants";
import { DataContext } from "../contexts/DataContext";
import { formatAmountWithCommas } from "../services/Utils";
import { ListItem, Button } from "@rneui/themed";
import { useNavigation } from "@react-navigation/native";
import { deleteTransactionWithId } from "../services/TransactionService";
import { Icon } from 'react-native-elements'


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

const TransactionsList = ({currentMonthTransactions}) => {
  const navigation=useNavigation()
  const { transactions, updateTransactions, banks, updateBanks } = useContext(DataContext);

  const handDeletion = async (reset, transactionId) => {
    try {
      const{updatedTransactions,updatedBanks}=await deleteTransactionWithId(transactionId, transactions, banks);
      updateTransactions(updatedTransactions);
      updateBanks(updatedBanks);
      reset()
  } catch (error) {
      console.error('Error deleting transaction:', error);
  }
  };
  const handleEdit=(reset,transaction)=>{
    reset();
    navigation.navigate('TransactionEdit',{transaction:transaction})
  }
  return (
    <SectionList
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: SIZES.padding * 8 }}
      sections={currentMonthTransactions.reduce((acc, transaction) => {
        const existingSection = acc.find(
          (section) => section.title === transaction.date
        );
        if (existingSection) {
          existingSection.data.push(transaction);
        } else {
          acc.push({ title: transaction.date, data: [transaction] });
        }
        return acc;
      }, [])}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => (
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
          <ListItem.Content >
            <View
              key={item.id}
              style={{
                flexDirection: "row",
                lignItems: "center",
                paddingVertical:SIZES.padding/4,
              }}
            >
              <View
                style={{
                  backgroundColor: COLORS.lightGray,
                  height: 50,
                  width: 50,
                  borderRadius: 25,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Icon
  name='rice-bowl'
  type="material"
  size={27}
  color={COLORS.lightBlue} />
              </View>
              <View style={{ flex: 1, marginLeft: SIZES.padding / 3 }}>
                <Text style={{ color: COLORS.primary, ...FONTS.h3 }}>
                  {item.title}
                </Text>
                <Text style={{ ...FONTS.body3, color: COLORS.darkgray }}>
                  {item.bank_name}
                </Text>
              </View>
              <View style={{ marginLeft: SIZES.padding }}>
                <Text
                  style={{
                    color: item.amount < 0 ? COLORS.red2 : COLORS.darkgreen,
                    ...FONTS.h2,
                  }}
                >
                  ₹{formatAmountWithCommas(Math.abs(item.amount))}
                </Text>
              </View>
            </View>
          </ListItem.Content>
        </ListItem.Swipeable>
      )}
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

import React from "react";
import { SectionList, View, Text, ScrollView, Image } from "react-native";
import { COLORS, FONTS, SIZES, icons, images } from "../constants";

const transactions = [
  {
    id: 1,
    title: "Food with Friends",
    amount: 600,
    date: "2024-04-13",
    bank: "HDFC",
    icon: icons.food,
  },
  {
    id: 2,
    title: "Shopping",
    amount: 200,
    date: "2024-04-13",
    bank: "SBI",
    icon: icons.cloth_icon,
  },
  {
    id: 3,
    title: "Groceries",
    amount: 200,
    date: "2024-04-12",
    bank: "ICICI",
    icon: icons.food,
  },
  {
    id: 5,
    title: "Food with Friends",
    amount: 500,
    date: "2024-04-12",
    bank: "HDFC",
    icon: icons.food,
  },
  {
    id: 6,
    title: "Shopping",
    amount: 300,
    date: "2024-04-09",
    bank: "SBI",
    icon: icons.cloth_icon,
  },
  {
    id: 7,
    title: "Groceries",
    amount: 200,
    date: "2024-04-09",
    bank: "ICICI",
    icon: icons.food,
  },
  // Add more transactions as needed
];
const getFormattedDate = (date) => {
  const today = new Date();
  const transactionDate = new Date(date);
  console.log(transactionDate.toDateString());
  console.log(today.toDateString());
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

const TransactionsList = () => {
  return (
    <SectionList
      sections={transactions.reduce((acc, transaction) => {
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
        <View
          key={item.id}
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: SIZES.padding / 2,
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
            <Image
              source={item.icon}
              style={{ width: 20, height: 20, tintColor: COLORS.lightBlue }}
            />
          </View>
          <View style={{ flex: 1, marginLeft: SIZES.padding / 3 }}>
            <Text style={{ color: COLORS.primary, ...FONTS.h3 }}>
              {item.title}
            </Text>
            <Text style={{ ...FONTS.body3, color: COLORS.darkgray }}>
              {item.bank}
            </Text>
          </View>
          <View style={{ marginLeft: SIZES.padding }}>
            <Text style={{ color: COLORS.red2, ...FONTS.h2 }}>
              ₹{item.amount}
            </Text>
          </View>
        </View>
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

import React from "react";
import { SectionList, View, Text, ScrollView, Image } from "react-native";
import { COLORS, FONTS, SIZES, icons, images } from "../constants";
import { formatAmountWithCommas } from "../services/Utils";
import { Icon } from "react-native-elements";
import { Transaction } from "../types/entity/Transaction";
import { useExpensifyStore } from "../store/store";
import { StyleSheet } from "react-native";

const TransactionCard: React.FC<{ item: Transaction }> = ({ item }) => {
  const account = useExpensifyStore((state) =>
    state.getAccountById(item.account_id),
  );
  const category = useExpensifyStore((state) =>
    state.getCategoryById(item.category_id),
  );
  return (
    <View key={item.id} style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon name={category.icon_name} type={category.icon_type} size={27} color={COLORS.lightBlue} />
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.title}>{item.description}</Text>
        <Text style={styles.bankName}>{account.name}</Text>
      </View>

      <View style={styles.amountContainer}>
        <Text
          style={[
            styles.amount,
            { color: item.is_credit ? COLORS.darkgreen : COLORS.red2 },
          ]}
        >
          ₹{formatAmountWithCommas(item.amount)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SIZES.padding / 4,
  },
  iconContainer: {
    backgroundColor: COLORS.lightGray,
    height: 50,
    width: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  infoContainer: {
    flex: 1,
    marginLeft: SIZES.padding / 3,
  },
  title: {
    color: COLORS.primary,
    ...FONTS.h3,
  },
  bankName: {
    ...FONTS.body3,
    color: COLORS.darkgray,
  },
  amountContainer: {
    marginLeft: SIZES.padding,
  },
  amount: {
    ...FONTS.c1,
  },
});

export default TransactionCard;

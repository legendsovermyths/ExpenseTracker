import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, SIZES, FONTS } from "../constants";
import { formatAmountWithCommas } from "../services/Utils";

const FeaturedCard = ({ item }) => {
  switch (item.description) {
    case "Upcoming Expense":
      return (
        <View style={styles.card}>
          <Text style={styles.categoryTitle}>{item.subscriptionTitle}</Text>
          <Text style={styles.categoryDescription}>{item.description}</Text>
          <Text style={styles.categorySpending}>
            Amount{" "}
            <Text style={{ color: COLORS.red2, ...FONTS.h3 }}>
              ₹{item.subscriptionAmount}
            </Text>{" "}
            {`to be paid for ${item.subscriptionTitle} in ${item.daysRemaining} ` +
              (item.daysRemaining > 1 ? "days" : "day")}
            .
          </Text>
        </View>
      );
    case "Featured Category":
      return (
        <View style={styles.card}>
          <Text style={styles.categoryTitle}>{item.category}</Text>
          <Text style={styles.categoryDescription}>Featured Category</Text>
          <Text style={styles.categorySpending}>
            You have spent{" "}
            <Text style={styles.amountText}>
              ₹{formatAmountWithCommas(item.spent)}
            </Text>{" "}
            on {item.category} this month over {item.transactions} transactions.
          </Text>
          {item.change != "N/A" ? (
            <Text style={styles.categoryComparison}>
              <Text
                style={[
                  styles.changeText,
                  {
                    color:
                      item.change[0] == "-" ? COLORS.darkgreen : COLORS.red2,
                  },
                ]}
              >
                {item.change} (₹{formatAmountWithCommas(item.lastMonth)})
              </Text>{" "}
              from last month at this time.
            </Text>
          ) : null}
        </View>
      );

    default:
      break;
  }
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.lightGray,
    padding: 5,
    borderRadius: 10,
    marginTop: SIZES.padding / 4,
    height: 170,
    width: 344,
    marginRight: 1,
  },
  categoryTitle: {
    marginTop: 10,
    marginLeft: 10,
    color: COLORS.secondary,
    ...FONTS.h2,
  },
  categoryDescription: {
    marginBottom: 5,
    marginLeft: 10,
    color: COLORS.darkgray,
    ...FONTS.body4,
  },
  categorySpending: {
    marginBottom: 5,
    marginLeft: 10,
    color: COLORS.primary,
    ...FONTS.body3,
  },
  amountText: {
    color: COLORS.red2,
    ...FONTS.h3,
  },
  categoryComparison: {
    marginBottom: 5,
    marginLeft: 10,
    color: COLORS.primary,
    ...FONTS.body3,
  },
  changeText: {
    color: COLORS.red2,
    ...FONTS.h3,
  },
});

export default FeaturedCard;

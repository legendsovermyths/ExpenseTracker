import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from "react-native";
import { COLORS, FONTS, SIZES } from "../constants";
import CustomFAB from "../components/CustomFAB";
import { formatAmountWithCommas, getFormattedDateWithYear } from "../services/Utils";



const SubscriptionScreen = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const subscriptions = [
    {
      id: 1,
      name: "Netflix",
      amount: -15.99,
      frequency: "Monthly",
      lastDate: "2024-04-01",
      nextDate: "2024-05-01",
    },
    {
      id: 2,
      name: "Gym Membership",
      amount: -50,
      frequency: "Every 2 Months",
      lastDate: "2024-03-15",
      nextDate: "2024-05-15",
    },
    {
      id: 3,
      name: "Salary",
      amount: 5000,
      frequency: "Monthly",
      lastDate: "2024-04-01",
      nextDate: "2024-05-01",
    },
  ];
  const filteredSubscriptions = subscriptions.filter((subscription) =>
    subscription.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const handleUnsubscribe = (id) => {
    console.log("Unsubscribe from subscription with id:", id);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.lightGray2 }}>
      <View
        style={{
          paddingHorizontal: SIZES.padding,
          paddingVertical: (5 * SIZES.padding) / 2,
          backgroundColor: COLORS.white,
        }}
      >
        <Text
          style={{
            marginLeft: SIZES.padding / 6,
            marginBottom: SIZES.padding / 2,
            color: COLORS.primary,
            ...FONTS.h1,
          }}
        >
          Subscriptions
        </Text>
        {/* Implement better search input */}
        {/* <TextInput
          style={styles.searchInput}
          placeholder="Search subscriptions"
          value={searchQuery}
          onChangeText={text => setSearchQuery(text)}
        /> */}
        <ScrollView>
          {filteredSubscriptions.map((subscription) => (
            <View key={subscription.id} style={styles.subscriptionCard}>
              <TouchableOpacity
                onPress={() => handleUnsubscribe(subscription.id)}
                style={styles.unsubscribeButton}
              >
                <Text style={styles.unsubscribeText}>Unsubscribe</Text>
              </TouchableOpacity>
              <Text style={styles.subscriptionName}>{subscription.name}</Text>
              <Text
                style={[
                  styles.amountText,
                  {
                    color:
                      subscription.amount < 0 ? COLORS.red2 : COLORS.darkgreen,
                  },
                ]}
              >
                Amount: ₹{formatAmountWithCommas(Math.abs(subscription.amount).toFixed(2))}
              </Text>
              <Text style={styles.infoText}>
                Frequency: {subscription.frequency}
              </Text>
              <Text style={styles.infoText}>
                Last {subscription.amount < 0 ? "Debited" : "Credited"}:{" "}
                {getFormattedDateWithYear(subscription.lastDate)}
              </Text>
              <Text style={styles.infoText}>
                Next {subscription.amount < 0 ? "Debit" : "Credit"}:{" "}
                {getFormattedDateWithYear(subscription.nextDate)}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
      <CustomFAB />
    </View>
  );
};

const styles = StyleSheet.create({
  subscriptionCard: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 10,
    padding: SIZES.padding,
    marginTop: SIZES.padding,
    elevation: 3,
    position: "relative",
  },
  subscriptionName: {
    ...FONTS.h3,
    color: COLORS.darkgray,
    marginBottom: 5,
  },
  amountText: {
    ...FONTS.body2,
    marginBottom: 5,
  },
  infoText: {
    ...FONTS.body3,
    color: COLORS.darkgray,
    marginBottom: 2,
  },
  unsubscribeButton: {
    position: "absolute",
    top: SIZES.padding / 2,
    right: SIZES.padding / 2,
    backgroundColor: COLORS.lightGray,
    padding: 5,
    borderRadius: 5,
  },
  unsubscribeText: {
    color: COLORS.darkgray,
    ...FONTS.body4,
  },
  searchInput: {
    borderWidth: 0.5,
    borderRadius: 8,
    borderColor: COLORS.primary,
    padding: 10,
    marginTop: SIZES.padding,
    marginBottom: SIZES.padding / 2,
    backgroundColor: COLORS.white,
    fontSize: 16,
  },
});

export default SubscriptionScreen;

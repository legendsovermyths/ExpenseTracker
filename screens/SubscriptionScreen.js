import React, { useContext, useState } from "react";
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
import { DataContext } from "../contexts/DataContext";
import { deleteSubscription } from "../services/SubscriptionService";



const SubscriptionScreen = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const { subscriptions, updateSubscriptions }= useContext(DataContext);
 
  const filteredSubscriptions = subscriptions.filter((subscription) =>
    subscription.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const handleUnsubscribe = async(id) => {
    const updatedSubscriptions=await deleteSubscription(id,subscriptions);
    updateSubscriptions(updatedSubscriptions);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      <View
        style={{
          paddingHorizontal: SIZES.padding,
          paddingTop: (5 * SIZES.padding) / 2,
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
        <ScrollView showsVerticalScrollIndicator={false} style={{marginBottom:SIZES.padding*2}}>
          {filteredSubscriptions.map((subscription) => (
            <View key={subscription.id} style={styles.subscriptionCard}>
              <TouchableOpacity
                onPress={() => handleUnsubscribe(subscription.id)}
                style={styles.unsubscribeButton}
              >
                <Text style={styles.unsubscribeText}>Unsubscribe</Text>
              </TouchableOpacity>
              <Text style={styles.subscriptionName}>{subscription.title}</Text>
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
                {getFormattedDateWithYear(subscription.last_date)}
              </Text>
              <Text style={styles.infoText}>
                Next {subscription.amount < 0 ? "Debit" : "Credit"}:{" "}
                {getFormattedDateWithYear(subscription.next_date)}
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

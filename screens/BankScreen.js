import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { COLORS, FONTS, SIZES } from "../constants";
import CustomFAB from "../components/CustomFAB";

const BankScreen = () => {
  // Dummy bank account data for demonstration
  const bankAccounts = [
    { id: 1, name: "HDFC", amount: 50000 },
    { id: 2, name: "ICICI", amount: 10000 },
    { id: 3, name: "KOTAK", amount: 75000 },
    // Add more dummy data if needed
  ];

  const handleDelete = (id) => {
    // Implement delete functionality here
    console.log("Delete account with id:", id);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.lightGray2 }}>
      {/* Header section */}
      <View
        style={{
          paddingHorizontal: SIZES.padding,
          paddingVertical: (5 * SIZES.padding) / 2,
          backgroundColor: COLORS.white,
        }}
      >
        <Text style={{ marginLeft: SIZES.padding / 6, color: COLORS.primary, ...FONTS.h1 }}>Accounts</Text>
        <ScrollView>
          {bankAccounts.map((account) => (
            <View key={account.id} style={styles.accountCard}>
              <TouchableOpacity onPress={() => handleDelete(account.id)} style={styles.deleteButton}>
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
              <Text style={styles.accountName}>{account.name}</Text>
              <Text style={styles.balanceText}>Balance: ₹{account.amount}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
      <CustomFAB/>
    </View>
  );
};

const styles = StyleSheet.create({
  accountCard: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 10,
    padding: SIZES.padding,
    marginTop: SIZES.padding,
    elevation: 3,
    position: "relative",
  },
  accountName: {
    ...FONTS.h3,
    color: COLORS.darkgray,
    marginBottom: 5,
  },
  balanceText: {
    ...FONTS.body3,
    color: COLORS.darkgreen,
  },
  deleteButton: {
    position: "absolute",
    top: SIZES.padding / 2,
    right: SIZES.padding / 2,
    backgroundColor: COLORS.lightGray,
    padding: 5,
    borderRadius: 5,
  },
  deleteText: {
    color: COLORS.red2,
    ...FONTS.body4,
  },
});

export default BankScreen;

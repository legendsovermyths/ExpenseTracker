import React, { useContext, useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { BANKCARDTHEMES, COLORS, FONTS, SIZES } from "../constants";
import CustomFAB from "../components/CustomFAB";
import { DataContext } from "../contexts/DataContext";
import { Button } from "react-native-paper";
import { deleteAccountFromDatabase } from "../services/DbUtils";
import CreditCard from "../components/CreditCard";
import Carousel from "react-native-snap-carousel";
import { formatAmountWithCommas } from "../services/Utils";
import { analyzeBankTransactions } from "../services/AccountServices";

const BankScreen = () => {
  const { transactions, banks, updateBanks } = useContext(DataContext);

  const { numTransactions, totalExpenditure, totalIncome } =
    banks.length > 0
      ? analyzeBankTransactions(transactions, banks[0].name)
      : { numTransactions: 0, totalExpenditure: 0, totalIncome: 0 };
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bankStats, setBankStats] = useState({
    numTransactions: numTransactions,
    totalIncome: totalIncome,
    totalExpenditure: totalExpenditure,
  });
  const deleteConfirmationAlert = () =>
    Alert.alert(
      `Delete Account ${banks[currentIndex].name}`,
      "Are you sure you want to delete this account?",
      [
        {
          text: "Cancel",
          onPress: () => console.log("Cancel Pressed"),
          style: "cancel",
        },
        { text: "Yes", onPress: () => handleDelete() },
      ],
    );
  const renderItem = ({ item }) => {
    const bankTheme = BANKCARDTHEMES.find(
      (theme) => theme.name == item.color_theme,
    );
    console.log(transactions);
    return (
      <CreditCard
        bankName={item.name}
        amount={item.amount}
        due_date={item.due_date}
        is_credit={item.is_credit}
        theme={bankTheme}
      />
    );
  };
  const onSnapToItem = (index) => {
    setCurrentIndex(index);
    const { numTransactions, totalExpenditure, totalIncome } =
      analyzeBankTransactions(transactions, banks[index].name);
    setBankStats({
      numTransactions: numTransactions,
      totalIncome: totalIncome,
      totalExpenditure: totalExpenditure,
    });
  };
  const handleDelete = () => {
    const idToRemove = banks[currentIndex].id;
    const updatedBanks = (prevBanks) =>
      prevBanks.filter((bank) => bank.id !== idToRemove);
    updateBanks(updatedBanks);
    deleteAccountFromDatabase(idToRemove);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      <View>
        <View style={styles.header}>
          <Text style={styles.headerText}>Accounts</Text>
        </View>
        {banks.length > 0 ? (
          <View>
            <Carousel
              data={banks}
              renderItem={renderItem}
              sliderWidth={SIZES.width}
              itemWidth={SIZES.width}
              layout="default"
              containerCustomStyle={styles.carouselContainer}
              slideStyle={styles.carouselSlide}
              onSnapToItem={onSnapToItem}
            />
            <View style={styles.statsWrapper}>
              <View style={styles.categoriesContainer}>
                {/* <Text style={styles.categoriesTitle}>Statistics</Text>*/}
                <View>
                  <View style={styles.statsContainer}>
                    <Text style={styles.statsText}>Total Expenditure:</Text>
                    <Text
                      style={[
                        styles.statsText,
                        { color: COLORS.red2, ...FONTS.h3 },
                      ]}
                    >
                      ₹
                      {formatAmountWithCommas(
                        Math.abs(bankStats.totalExpenditure),
                      )}
                    </Text>
                  </View>
                  <View style={styles.statsContainer}>
                    <Text style={styles.statsText}>Total Income:</Text>
                    <Text
                      style={[
                        styles.statsText,
                        { color: COLORS.darkgreen, ...FONTS.h3 },
                      ]}
                    >
                      ₹{formatAmountWithCommas(bankStats.totalIncome)}
                    </Text>
                  </View>
                  <View style={styles.statsContainer}>
                    <Text style={styles.statsText}>Total Transactions:</Text>
                    <Text style={[styles.statsText, { ...FONTS.h3 }]}>
                      {bankStats.numTransactions}
                    </Text>
                  </View>
                  {banks[currentIndex].is_credit === 1 ? (
                    <View style={styles.statsContainer}>
                      <Text style={styles.statsText}>Invoice Frequency:</Text>
                      <Text style={[styles.statsText, { ...FONTS.h3 }]}>
                        {banks[currentIndex].frequency}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.statsContainer}>
                    <Text style={styles.statsText}>Date Registered:</Text>
                    <Text style={[styles.statsText, { ...FONTS.h3 }]}>
                      {banks[currentIndex].date}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
            <Button
              mode="contained"
              onPress={deleteConfirmationAlert}
              style={styles.cancelButton}
            >
              <Text style={{ color: COLORS.red }}>Delete Account</Text>
            </Button>
          </View>
        ) : (
          <View
            style={{
              justifyContent: "center",
              alignItems: "center",
              marginTop: 200,
            }}
          >
            <Text style={{ color: COLORS.primary, ...FONTS.body3 }}>
              You have no accounts
            </Text>
          </View>
        )}
      </View>

      <CustomFAB />
    </View>
  );
};
const styles = StyleSheet.create({
  header: {
    paddingHorizontal: SIZES.padding,
    paddingTop: (5 * SIZES.padding) / 2,
    backgroundColor: COLORS.white,
  },
  headerText: {
    marginLeft: SIZES.padding / 6,
    color: COLORS.primary,
    ...FONTS.h1,
  },
  carouselContainer: {
    paddingHorizontal: 10,
    padding: 0,
    margin: 0,
  },
  carouselSlide: {
    paddingHorizontal: 0,
    padding: 0,
    margin: 0,
  },
  statsWrapper: {
    paddingHorizontal: SIZES.padding,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statsText: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    color: COLORS.primary,
    ...FONTS.body3,
  },
  categoriesContainer: {
    backgroundColor: COLORS.white,
    padding: 5,
    borderRadius: 20,
  },
  categoriesTitle: {
    marginTop: 10,
    marginLeft: 10,
    color: COLORS.primary,
    ...FONTS.h2,
  },
  categoriesCount: {
    marginBottom: 5,
    marginLeft: 10,
    color: COLORS.darkgray,
    ...FONTS.body4,
  },
  cancelButton: {
    marginTop: 20,
    backgroundColor: "transparent",
    borderRadius: 20,
    color: COLORS.red2,
  },
});

export default BankScreen;

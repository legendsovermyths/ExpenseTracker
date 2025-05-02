import React, { useState, useRef, useMemo } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { BANKCARDTHEMES, COLORS, FONTS, SIZES } from "../constants";
import CustomFAB from "../components/CustomFAB";
import { Button } from "react-native-paper";
import CreditCard from "../components/CreditCard";
import Carousel from "react-native-snap-carousel";
import { useExpensifyStore } from "../store/store";
import {
  analyzeAccountTransactions,
  deleteAccount,
} from "../services/AccountService";
import {
  formatISODateToLocalDate,
  formatAmountWithCommas,
} from "../services/_Utils";
import type { RefObject } from "react";
import type { ListRenderItemInfo } from "react-native-snap-carousel";

const BankScreen: React.FC = () => {
  const carouselRef: RefObject<Carousel<any>> = useRef(null);
  const accountsById = useExpensifyStore((state) => state.accounts);
  const transactionsById = useExpensifyStore((state) => state.transactions);
  const deleteAccountUI = useExpensifyStore((state) => state.deleteAccount);
  const transactions = Object.values(transactionsById);
  const accounts = Object.values(accountsById).filter(
    (account) => !account.is_deleted,
  );
  const [currentIndex, setCurrentIndex] = useState(0);

  const bankAnalysisData = useMemo(() => {
    if (accounts.length > 0) {
      return analyzeAccountTransactions(transactions, accounts);
    }
    return [];
  }, [transactions, accounts]);

  const deleteConfirmationAlert = () =>
    Alert.alert(
      `Delete Account ${accounts[currentIndex].name}`,
      "Are you sure you want to delete this account?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Yes",
          onPress: async () => await handleDelete(accounts[currentIndex]),
        },
      ],
    );

  const renderItem = ({ item }: ListRenderItemInfo<any>) => {
    const bankTheme = BANKCARDTHEMES.find((theme) => theme.name === item.theme);
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

  const onSnapToItem = (index: number) => {
    setCurrentIndex(index);
  };

  const handleDelete = async (account: any) => {
    let lengthAfterDeletion = accounts.length - 2;
    setCurrentIndex((currentIndex) => (currentIndex + 1) % lengthAfterDeletion);
    let response = await deleteAccount(account);
    deleteAccountUI(account.id);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      <View>
        <View style={styles.header}>
          <Text style={styles.headerText}>Accounts</Text>
        </View>
        {accounts.length > 0 ? (
          <View>
            <Carousel
              data={accounts}
              renderItem={renderItem}
              sliderWidth={SIZES.width}
              itemWidth={SIZES.width}
              layout="default"
              containerCustomStyle={styles.carouselContainer}
              slideStyle={styles.carouselSlide}
              onSnapToItem={onSnapToItem}
              ref={carouselRef}
            />
            <View style={styles.statsWrapper}>
              <View style={styles.categoriesContainer}>
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
                        bankAnalysisData[currentIndex]?.at(1),
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
                      ₹
                      {formatAmountWithCommas(
                        bankAnalysisData[currentIndex]?.at(2),
                      )}
                    </Text>
                  </View>
                  <View style={styles.statsContainer}>
                    <Text style={styles.statsText}>Total Transactions:</Text>
                    <Text style={[styles.statsText, { ...FONTS.h3 }]}>
                      {bankAnalysisData[currentIndex]?.at(0)}
                    </Text>
                  </View>
                  {accounts[currentIndex].is_credit === true && (
                    <View style={styles.statsContainer}>
                      <Text style={styles.statsText}>Invoice Frequency:</Text>
                      <Text style={[styles.statsText, { ...FONTS.h3 }]}>
                        {accounts[currentIndex].frequency}
                      </Text>
                    </View>
                  )}
                  {accounts[currentIndex].is_credit === true && (
                    <View style={styles.statsContainer}>
                      <Text style={styles.statsText}>Next Invoice:</Text>
                      <Text style={[styles.statsText, { ...FONTS.h3 }]}>
                        {formatISODateToLocalDate(
                          accounts[currentIndex].due_date,
                        )}
                      </Text>
                    </View>
                  )}
                  <View style={styles.statsContainer}>
                    <Text style={styles.statsText}>Date Registered:</Text>
                    <Text style={[styles.statsText, { ...FONTS.h3 }]}>
                      {formatISODateToLocalDate(
                        accounts[currentIndex].date_time,
                      )}
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

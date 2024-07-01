import React, { useContext } from "react";
import { View, Text, StyleSheet } from "react-native";
import { BANKCARDTHEMES, COLORS, FONTS, SIZES } from "../constants";
import CustomFAB from "../components/CustomFAB";
import { DataContext } from "../contexts/DataContext";
import { deleteAccountFromDatabase } from "../services/DbUtils";
import CreditCard from "../components/CreditCard";
import Carousel from "react-native-snap-carousel";

const BankScreen = () => {
  const { banks, updateBanks } = useContext(DataContext);
  const renderItem = ({ item }) => {
    console.log(BANKCARDTHEMES);
    const bankTheme = BANKCARDTHEMES.find(
      (theme) => theme.name == item.color_theme,
    );
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

  const handleDelete = (idToRemove) => {
    const updatedBanks = (prevBanks) =>
      prevBanks.filter((bank) => bank.id !== idToRemove);
    updateBanks(updatedBanks);
    deleteAccountFromDatabase(idToRemove);
  };
  console.log(banks);
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      <View>
        <View style={styles.header}>
          <Text style={styles.headerText}>Accounts</Text>
        </View>

        <Carousel
          data={banks}
          renderItem={renderItem}
          sliderWidth={SIZES.width}
          itemWidth={SIZES.width}
          layout="default"
          containerCustomStyle={styles.carouselContainer}
          slideStyle={styles.carouselSlide}
        />
        <View style={styles.statsWrapper}>
          <View style={styles.categoriesContainer}>
            <Text style={styles.categoriesTitle}>Statistics</Text>
          </View>
        </View>
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
  categoriesContainer: {
    backgroundColor: COLORS.lightGray,
    padding: 5,
    borderRadius: 20,
  },
  categoriesTitle: {
    marginTop: 10,
    marginLeft: 10,
    color: COLORS.primary,
    ...FONTS.h3,
  },
  categoriesCount: {
    marginBottom: 5,
    marginLeft: 10,
    color: COLORS.darkgray,
    ...FONTS.body4,
  },
});

export default BankScreen;

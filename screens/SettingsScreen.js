import React, { useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { COLORS, FONTS, SIZES } from "../constants";
import CustomFAB from "../components/CustomFAB";
import { DataContext } from "../contexts/DataContext";
import { deleteAccountFromDatabase } from "../services/DbUtils";
import { formatAmountWithCommas } from "../services/Utils";

const SettingsScreen = () => {
  const { banks, updateBanks } = useContext(DataContext);

  const handleDelete = (idToRemove) => {
    const updatedBanks = (prevBanks) =>
      prevBanks.filter((bank) => bank.id !== idToRemove);
    updateBanks(updatedBanks);
    deleteAccountFromDatabase(idToRemove);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      {/* Header section */}
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
            color: COLORS.primary,
            ...FONTS.h1,
          }}
        >
          Settings
        </Text>
      </View>
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

export default SettingsScreen;

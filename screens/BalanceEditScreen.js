import React, { useContext, useState } from "react";
import { View, StyleSheet, Text } from "react-native";
import { TextInput, Button, Provider } from "react-native-paper";
import { COLORS, SIZES, FONTS } from "../constants";
import { useNavigation } from "@react-navigation/native";
import { DataContext } from "../contexts/DataContext";

const BalaceEditScreen = () => {
  const { constants, updateConstants } = useContext(DataContext);
  const initialBalance = constants.find(
    (item) => item.name === "balance",
  )?.value;
  const [balance, setBalance] = useState(initialBalance.toString());
  const navigation = useNavigation();
  const handleUpdateBalance = async () => {
    const newBalance = await updateBalance(Number(balance));
    const updatedConstants = constants.map((item) => {
      if (item.name === "balance") {
        return { ...item, value: newBalance };
      }
      return item;
    });
    updateConstants(updatedConstants);
    navigation.pop();
  };
  const handleCancelInput = () => {
    navigation.pop();
  };
  return (
    <Provider>
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.white,
          paddingVertical: (5 * SIZES.padding) / 2,
        }}
      >
        <View
          style={{
            paddingHorizontal: SIZES.padding,
            paddingTop: (4 * SIZES.padding) / 3,
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
            Edit monthy budget
          </Text>
        </View>
        <View style={styles.container}>
          <TextInput
            mode="outlined"
            outlineColor={COLORS.primary}
            activeOutlineColor={COLORS.primary}
            label="Balance"
            value={balance}
            onChangeText={setBalance}
            keyboardType="numeric"
            style={[styles.input, { backgroundColor: COLORS.white }]}
            theme={{ roundness: 30 }}
          />

          <Button
            mode="contained"
            onPress={handleUpdateBalance}
            style={styles.addButton}
          >
            Update
          </Button>
          <Button
            mode="contained"
            onPress={handleCancelInput}
            style={styles.cancelButton}
          >
            <Text style={{ color: COLORS.red }}>Cancel</Text>
          </Button>
        </View>
      </View>
    </Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
    backgroundColor: COLORS.white,
  },
  input: {
    marginBottom: 20,
    borderRadius: 20,
  },
  addButton: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
  },
  menuButton: {
    borderColor: COLORS.primary,
    borderRadius: 30,
    borderWidth: 1,
    backgroundColor: COLORS.white,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 20,
  },
  cancelButton: {
    marginTop: 20,
    backgroundColor: "transparent",
    borderRadius: 20,
    color: COLORS.red2,
  },
});

export default BalaceEditScreen;

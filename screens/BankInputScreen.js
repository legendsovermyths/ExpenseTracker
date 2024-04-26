import React, { useContext, useState } from "react";
import { View, StyleSheet, Text, Keyboard } from "react-native";
import {
  TextInput,
  Button,
  Menu,
  Provider,
  DefaultTheme,
} from "react-native-paper";
import { COLORS, SIZES, FONTS } from "../constants"; // Assuming you have a COLORS and SIZES constant
import { useNavigation } from "@react-navigation/native";
import { DataContext } from "../contexts/DataContext";
import { addAccountToDatabase } from "../services/dbUtils";

const BankInputScreen = () => {
  const {banks,updateBanks} = useContext(DataContext)
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const navigation = useNavigation();
  const handleAddAccount =async () => {
    if (!name.trim() || !amount.trim()) {
      setError("Name or Amount cannot be empty");
      return;
    }
  
    const upperCaseName = name.toUpperCase();
    if (banks.some(bank => bank.name=== upperCaseName)) {
      setError("The bank name aready exists");
      return;
    }
    const id=await addAccountToDatabase({name:upperCaseName,amount:amount})
    if(id!=null){
      updateBanks([...banks,{name:upperCaseName,amount:amount,id:id}]);
    }
    navigation.pop();
    
  };
  const handleCancelInput = () => {
    navigation.pop();
  };
  return (
    <Provider>
      <View style={{ flex: 1, backgroundColor: COLORS.lightGray2 }}>
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
            Bank details
          </Text>
        </View>
        <View style={styles.container}>
          <TextInput
            mode="outlined"
            outlineColor={COLORS.primary}
            activeOutlineColor={COLORS.primary}
            label="Name"
            value={name}
            onChangeText={setName}
            style={[styles.input, { backgroundColor: COLORS.white }]}
            theme={{ roundness: 30 }}
          />
          <TextInput
            mode="outlined"
            outlineColor={COLORS.primary}
            activeOutlineColor={COLORS.primary}
            label="Balance"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            style={[styles.input, { backgroundColor: COLORS.white }]}
            theme={{ roundness: 30 }}
          />
          {error ? <Text style={{ color: COLORS.red, marginBottom: 20,marginLeft:10 }}>{error}</Text> : null}

          <Button
            mode="contained"
            onPress={handleAddAccount}
            style={styles.addButton}
          >
            Add account
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

export default BankInputScreen;

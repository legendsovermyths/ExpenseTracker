import React, { useContext, useState } from "react";
import { View, StyleSheet, Text, TouchableOpacity } from "react-native";
import { Button, Menu, Provider, DefaultTheme } from "react-native-paper";

import { COLORS, SIZES, BANKCARDTHEMES } from "../constants";
import { useNavigation } from "@react-navigation/native";
import { DataContext } from "../contexts/DataContext";
import subscriptionFrequency from "../constants/subscriptionFrequency";
import { addAccount } from "../services/AccountService";
import {
  CustomKeyboard,
  useCustomKeyboard,
} from "../components/CustomKeyboard";
import HeaderNavigator from "../components/HeaderNavigator";
import HeaderText from "../components/HeaderText";
import DescriptionInput from "../components/DescriptionInput";
import AmountInput from "../components/AmountInput";
import CustomCheckbox from "../components/CustomCheckbox";
import DatePicker from "../components/DatePicker";
import { useExpensifyStore } from "../store/store";

const BankInputScreen = () => {
  const accountsById = useExpensifyStore((state) => state.accounts);
  const addAccountUI = useExpensifyStore((state) => state.addAccount);
  const accounts = Object.values(accountsById);
  const { _expression, onKeyPress, evaluateExpression } = useCustomKeyboard();
  const [amount, setAmount] = useState("0");
  const [name, setName] = useState("");
  const [activePopup, setActivePopup] = useState(null);
  const [error, setError] = useState("");
  const [selectedCredit, setSelectedCredit] = useState(0);
  const [date, setDate] = useState(new Date());
  const [selectedFrequency, setSelectedFrequency] = useState(null);
  const [selectedTheme, setSelectedTheme] = useState(null);
  const navigation = useNavigation();

  const currentDate = new Date();

  const handlePopupChange = (popupType) => {
    const amountResult = evaluateExpression();
    setAmount(amountResult);
    setActivePopup(popupType);
  };
  const isPopupActive = (popupType) => activePopup === popupType;
  const handleAddAccount = async () => {
    if (!name.trim() || !amount.trim()) {
      setError("Name or Amount cannot be empty");
      return;
    }
    const upperCaseName = name.toUpperCase();
    if (accounts.some((bank) => bank.name === upperCaseName)) {
      setError("The bank name aready exists");
      return;
    }
    const account = makeAccountObject();
    const accountWithId = await addAccount(account);
    addAccountUI(accountWithId);
    navigation.pop();
  };
  const makeAccountObject = () => {
    const upperCaseName = name.toUpperCase();
    const newBank = {
      name: upperCaseName,
      amount: Number(amount),
      is_credit: Boolean(selectedCredit),
      date_time: new Date().toISOString(),
      due_date: selectedFrequency ? date.toISOString() : null,
      theme: selectedTheme,
      frequency: selectedFrequency,
      is_deleted: false,
    };
    return newBank;
  };

  const handleSelectFrequency = (selectedFrequency) => {
    setSelectedFrequency(selectedFrequency);
    handlePopupChange("none");
  };
  const handleSelectTheme = (selectedTheme) => {
    setSelectedTheme(selectedTheme);
    handlePopupChange("none");
  };
  const handleCancelInput = () => {
    navigation.pop();
  };
  const handleDateChange = (selectedDate) => {
    const dateSelected = selectedDate || currentDate;
    setDate(dateSelected);
    handlePopupChange("none");
  };

  const menuTheme = {
    ...DefaultTheme,
    roundness: 20,
    colors: {
      ...DefaultTheme.colors,
      elevation: {
        ...DefaultTheme.colors.elevation,
        level2: COLORS.white,
      },
    },
  };
  return (
    <Provider>
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.white,
          paddingTop: (5 * SIZES.padding) / 2,
        }}
      >
        <View
          style={{
            paddingHorizontal: SIZES.padding,
            backgroundColor: COLORS.white,
          }}
        >
          <HeaderNavigator
            onBackPress={handleCancelInput}
            onTickPress={handleAddAccount}
          />
          <HeaderText text="Add New Account" />
        </View>
        <View style={styles.container}>
          <DescriptionInput
            label={"Name"}
            onChangeValue={setName}
            value={name}
            onFocus={() => handlePopupChange("None")}
          />
          <AmountInput
            value={amount}
            keyboardVisible={isPopupActive("customKeyboard")}
            setKeyboardVisible={() => handlePopupChange("customKeyboard")}
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: SIZES.padding / 2,
            }}
          >
            <CustomCheckbox
              selected={selectedCredit === 1}
              onPress={() => setSelectedCredit(1)}
              title="Credit"
            />
            <CustomCheckbox
              selected={selectedCredit === 0}
              onPress={() => setSelectedCredit(0)}
              title="Debit"
            />
          </View>
          <TouchableOpacity onPress={() => handlePopupChange("frequencyMenu")}>
            {selectedCredit == 1 ? (
              <Menu
                visible={isPopupActive("frequencyMenu")}
                onDismiss={() => handlePopupChange("None")}
                theme={menuTheme}
                anchor={
                  <Button
                    onPress={() => handlePopupChange("frequencyMenu")}
                    style={styles.menuButton}
                  >
                    <Text style={{ color: COLORS.black }}>
                      {selectedFrequency
                        ? selectedFrequency
                        : "Select Frequency"}
                    </Text>
                  </Button>
                }
                style={{ width: 200 }}
              >
                {subscriptionFrequency.map((frequency) => (
                  <Menu.Item
                    key={frequency}
                    onPress={() => handleSelectFrequency(frequency)}
                    title={frequency}
                  />
                ))}
              </Menu>
            ) : null}
          </TouchableOpacity>
          {selectedCredit == 1 ? (
            <DatePicker
              onDateChange={handleDateChange}
              maximumDate={currentDate}
              value={date}
              visible={isPopupActive("datePicker")}
              onTouchStart={() => handlePopupChange("datePicker")}
              position={{ top: 432, left: 22 }}
            />
          ) : null}
          <Menu
            visible={isPopupActive("themeMenu")}
            onDismiss={() => handlePopupChange("none")}
            theme={menuTheme}
            anchor={
              <Button
                onPress={() => handlePopupChange("themeMenu")}
                style={styles.menuButton}
              >
                <Text style={{ color: COLORS.black }}>
                  {selectedTheme ? selectedTheme : "Select Card Theme"}
                </Text>
              </Button>
            }
            style={{ width: 200 }}
          >
            {BANKCARDTHEMES.map((theme) => (
              <Menu.Item
                key={theme.name}
                onPress={() => handleSelectTheme(theme.name)}
                title={theme.name}
              />
            ))}
          </Menu>

          {error ? (
            <Text
              style={{ color: COLORS.red, marginBottom: 20, marginLeft: 10 }}
            >
              {error}
            </Text>
          ) : null}

          <Button
            mode="contained"
            onPress={handleAddAccount}
            style={styles.addButton}
          >
            Add account
          </Button>
        </View>
        {isPopupActive("customKeyboard") ? (
          <View style={styles.modalContent}>
            <CustomKeyboard
              onKeyPress={(key) => {
                const result = onKeyPress(key);
                setAmount(result);
              }}
            />
          </View>
        ) : null}
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
    paddingHorizontal: 10,
    paddingVertical: 5,
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

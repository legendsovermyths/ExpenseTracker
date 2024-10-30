import React, { useContext, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  Keyboard,
  TouchableOpacity,
  Image,
} from "react-native";
import {
  TextInput,
  Button,
  Menu,
  Provider,
  DefaultTheme,
} from "react-native-paper";

import DateTimePicker from "@react-native-community/datetimepicker";
import { CheckBox } from "@rneui/themed";
import { calculateNextDate, getDateFromDefaultDate } from "../services/Utils";
import { COLORS, SIZES, FONTS, icons, BANKCARDTHEMES } from "../constants";
import { useNavigation } from "@react-navigation/native";
import { DataContext } from "../contexts/DataContext";
import subscriptionFrequency from "../constants/subscriptionFrequency";
import { addAccount } from "../services/AccountServices";

const BankInputScreen = () => {
  const { banks, updateBanks } = useContext(DataContext);
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [selectedCredit, setSelectedCredit] = useState(0);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedFrequency, setSelectedFrequency] = useState(null);
  const [showFrequencyMenu, setFrequencyMenu] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const navigation = useNavigation();

  const currentDate = new Date();
  const handleAddAccount = async () => {
    if (!name.trim() || !amount.trim()) {
      setError("Name or Amount cannot be empty");
      return;
    }
    const upperCaseName = name.toUpperCase();
    if (banks.some((bank) => bank.name === upperCaseName)) {
      setError("The bank name aready exists");
      return;
    }
    const bankWithoutId = makeAccountObject();
    const updatedBanks = await addAccount(bankWithoutId, banks);
    updateBanks(updatedBanks);
    navigation.pop();
  };
  const makeAccountObject = () => {
    const upperCaseName = name.toUpperCase();
    const newBank = {
      name: upperCaseName,
      amount: amount,
      is_credit: selectedCredit,
      date: getDateFromDefaultDate(new Date()),
      due_date: getDateFromDefaultDate(date),
      color_theme: selectedTheme,
      frequency: selectedFrequency,
    };
    return newBank;
  };
  const handleSelectFrequency = (selectedFrequency) => {
    setSelectedFrequency(selectedFrequency);
    setFrequencyMenu(false);
  };
  const handleSelectTheme = (selectedTheme) => {
    setSelectedTheme(selectedTheme);
    setShowThemeMenu(false);
  };
  const handleFrequencyMenuPopUp = () => {
    setShowDatePicker(false);
    setShowThemeMenu(false);
    setFrequencyMenu(true);
    Keyboard.dismiss();
  };
  const handleThemeMenuPopUp = () => {
    setShowDatePicker(false);
    setFrequencyMenu(false);
    setShowThemeMenu(true);
    Keyboard.dismiss();
  };
  const handleCancelInput = () => {
    navigation.pop();
  };
  const handleDateChange = (event, selectedDate) => {
    const dateSelected = selectedDate || currentDate;
    setDate(dateSelected);
    setShowDatePicker(false);
  };
  const handleDateInputPopUp = () => {
    setShowDatePicker(true);
    Keyboard.dismiss();
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
          <TouchableOpacity onPress={handleCancelInput}>
            <Image
              source={icons.back_arrow}
              style={{ width: 30, height: 30, tintColor: COLORS.primary }}
            />
          </TouchableOpacity>
          <Text
            style={{
              marginTop: SIZES.padding / 2,
              marginLeft: SIZES.padding / 6,
              color: COLORS.primary,
              ...FONTS.h1,
            }}
          >
            Add New Account
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
            label={selectedCredit == 1 ? "Outstanding" : "Balance"}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            style={[styles.input, { backgroundColor: COLORS.white }]}
            theme={{ roundness: 30 }}
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: SIZES.padding / 2,
            }}
          >
            <CheckBox
              checked={selectedCredit === 1}
              onPress={() => setSelectedCredit(1)}
              checkedIcon="dot-circle-o"
              uncheckedIcon="circle-o"
              title="Credit"
              checkedColor={COLORS.primary}
            />

            <CheckBox
              checked={selectedCredit === 0}
              onPress={() => setSelectedCredit(0)}
              title="Debit"
              checkedIcon="dot-circle-o"
              uncheckedIcon="circle-o"
              checkedColor={COLORS.primary}
            />
          </View>
          <TouchableOpacity onPress={() => handleFrequencyMenuPopUp()}>
            {selectedCredit == 1 ? (
              <Menu
                visible={showFrequencyMenu}
                onDismiss={() => setFrequencyMenu(false)}
                theme={menuTheme}
                anchor={
                  <Button
                    onPress={() => handleFrequencyMenuPopUp()}
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
            <TextInput
              outlineColor={COLORS.primary}
              activeOutlineColor={COLORS.primary}
              mode="outlined"
              label="Last Invoice"
              value={date.toLocaleDateString()}
              editable={false}
              onTouchStart={() => handleDateInputPopUp()}
              style={[styles.input, { backgroundColor: COLORS.white }]}
              theme={{ roundness: 30 }}
            />
          ) : null}
          {showDatePicker && (
            <DateTimePicker
              testID="dateTimePicker"
              value={date}
              mode="date"
              is24Hour={true}
              display="inline"
              onChange={handleDateChange}
              style={{
                position: "absolute",
                backgroundColor: COLORS.white,
                bottom: 150,
                left: 30,
                zIndex: 100,
                borderRadius: 20,
              }}
              maximumDate={currentDate}
            />
          )}
          <Menu
            visible={showThemeMenu}
            onDismiss={() => setShowThemeMenu(false)}
            theme={menuTheme}
            anchor={
              <Button
                onPress={() => handleThemeMenuPopUp()}
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

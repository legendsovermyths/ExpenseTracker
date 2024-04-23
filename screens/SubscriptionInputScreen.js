import React, { useState } from "react";
import { CheckBox } from "@rneui/themed";
import { View, StyleSheet, Text, Keyboard } from "react-native";
import subscriptionFrequency from "../constants/subscriptionFrequency";
import {
  TextInput,
  Button,
  Menu,
  Provider,
  DefaultTheme,
  RadioButton,
} from "react-native-paper";
import { COLORS, SIZES, FONTS } from "../constants";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useNavigation } from "@react-navigation/native";

const SubscriptionInputScreen = () => {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIndex, setIndex] = useState(0);
  const [showFrequencyMenu, setFrequencyMenu] = useState(false);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedFrequency, setSelectedFrequency] = useState(null);
  const [frequencyAnchor, setFrequencyAnchor] = useState({ x: 0, y: 0 });

  const navigation = useNavigation();
  const handleAddTransaction = () => {
    console.log("Adding transaction:", {
      amount,
      description,
      selectedBank,
      selectedCategory,
      date,
    });
    navigation.goBack();
  };
  const handleCancelInput = () => {
    navigation.pop();
  };
  const handleSelectFrequency = (frequency) => {
    setSelectedFrequency(frequency);
    setFrequencyMenu(false);
  };
  const handleDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || currentDate;
    setShowDatePicker(false);
    setDate(currentDate);
  };
  const handleFrequencyMenuPopUp = (event) => {
    const nativeEvent = event.nativeEvent;
    const anchor = {
      x: nativeEvent.locationX,
      y: nativeEvent.pageY - 105,
    };
    setFrequencyAnchor(anchor);
    setFrequencyMenu(true);
    Keyboard.dismiss();
  };

  const handleDateInputPopUp = () => {
    setShowDatePicker(true);
    Keyboard.dismiss();
  };
  const menuTheme = {
    ...DefaultTheme,
    roundness: 20, // Set the roundness of the menu
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
            Subscription details
          </Text>
        </View>
        <View style={styles.container}>
          <TextInput
            mode="outlined"
            outlineColor={COLORS.primary}
            activeOutlineColor={COLORS.primary}
            label="Name"
            value={description}
            onChangeText={setDescription}
            style={[styles.input, { backgroundColor: COLORS.white }]}
            theme={{ roundness: 30 }} // Make the outlined text input round
          />
          <TextInput
            mode="outlined"
            outlineColor={COLORS.primary}
            activeOutlineColor={COLORS.primary}
            label="Amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            style={[styles.input, { backgroundColor: COLORS.white }]}
            theme={{ roundness: 30 }} // Make the outlined text input round
          />
          <Button onPress={handleFrequencyMenuPopUp} style={styles.menuButton}>
            <Text style={{ color: COLORS.black }}>
              {selectedFrequency ? selectedFrequency : "Frequency"}
            </Text>
          </Button>
          <Menu
            visible={showFrequencyMenu}
            onDismiss={() => setFrequencyMenu(false)}
            theme={menuTheme}
            anchor={frequencyAnchor}
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
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: SIZES.padding / 2,
            }}
          >
            <CheckBox
              checked={selectedIndex === 0}
              onPress={() => setIndex(0)}
              checkedIcon="dot-circle-o"
              uncheckedIcon="circle-o"
              title="Credit"
              checkedColor={COLORS.primary}
            />

            <CheckBox
              checked={selectedIndex === 1}
              onPress={() => setIndex(1)}
              title="Debit"
              checkedIcon="dot-circle-o"
              uncheckedIcon="circle-o"
              checkedColor={COLORS.primary}
            />
          </View>

          <TextInput
            outlineColor={COLORS.primary}
            activeOutlineColor={COLORS.primary}
            mode="outlined"
            label={selectedIndex == 0 ? "Next credit" : "Next debit"}
            value={date.toLocaleDateString()}
            editable={false}
            onTouchStart={() => handleDateInputPopUp()}
            style={[styles.input, { backgroundColor: COLORS.white }]}
            theme={{ roundness: 30 }}
          />

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
                bottom: 90,
                left: 30,
                zIndex: 100,
                borderRadius: 20,
              }}
            />
          )}
          <Button
            mode="contained"
            onPress={handleAddTransaction}
            style={styles.addButton}
          >
            Add subscription
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

export default SubscriptionInputScreen;

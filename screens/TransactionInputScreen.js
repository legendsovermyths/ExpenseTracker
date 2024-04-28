import React, { useContext, useState } from "react";
import { View, StyleSheet, Text, Keyboard, Touchable } from "react-native";
import { CheckBox } from "@rneui/themed";
import {
  TextInput,
  Button,
  Menu,
  Provider,
  DefaultTheme,
} from "react-native-paper";
import { COLORS, SIZES, FONTS } from "../constants"; // Assuming you have a COLORS and SIZES constant
import { Colors } from "react-native/Libraries/NewAppScreen";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useNavigation, useRoute } from "@react-navigation/native";
import categories from "../constants/category";
import { DataContext } from "../contexts/DataContext";
import {
  updateBankInDatabase,
  addTransactionToDatabase,
} from "../services/dbUtils";
import IconCategoryMapping from "../services/IconCategoryMapping";
import { addTransaction, editExistingTransaction } from "../services/TransactionService";
import { TouchableOpacity } from "react-native";

const TransactionInputScreen = () => {
  route=useRoute()
  let transaction=null;
  if(route.params){
    transaction=route.params.transaction;
  }
  const { banks, transactions, updateTransactions, updateBanks } = useContext(DataContext);
  const [amount, setAmount] = useState(transaction?Math.abs(transaction.amount).toString():"");
  const [selectedCredit, setSelectedCredit] = useState(transaction?Number((transaction.amount>0)):0);
  const [checkOnRecord, setCheckOnRecord] = useState(transaction?(transaction.on_record>0):true);
  const [description, setDescription] = useState(transaction?transaction.title:"");
  const [selectedBank, setSelectedBank] = useState(transaction?transaction.bank_name:null);
  const [selectedCategory, setSelectedCategory] = useState(transaction?transaction.category:null);
  const [showBankMenu, setBankMenu] = useState(false);
  const [showCategoryMenu, setCategoryMenu] = useState(false);
  const [date, setDate] = useState(transaction?new Date(transaction.date):new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [bankAnchor, setBankAnchor] = useState({ x: 0, y: 0 });
  const [error, setError] = useState(null);
  const currentDate = new Date();
  const navigation = useNavigation();
  const makeTransactionObject=()=>{
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    const formattedDate = `${year}-${month}-${day}`;

    if (
      !amount.trim ||
      !description.trim() ||
      selectedBank == null ||
      selectedCategory == null
    ) {
      setError("Please fill all the required values.");
      return;
    }
    const signedAmount = selectedCredit == 1 ? amount : -amount;
    const newTransaction = {
      amount: signedAmount,
      title: description,
      on_record: Number(checkOnRecord),
      bank_name: selectedBank,
      date: formattedDate,
      category: selectedCategory,
      icon: IconCategoryMapping[selectedCategory],
    };
    return newTransaction;
  }
  const handleAddTransaction = async () => {
    const newTransaction = makeTransactionObject()
    console.log(banks);
    const {updatedTransactions, updatedBanks}=await addTransaction(newTransaction, transactions, banks);
    updateBanks(updatedBanks);
    updateTransactions(updatedTransactions)
    navigation.pop();
  };

  const handleEditTransaction=async()=>{
    const newTransaction = makeTransactionObject();
    const {updatedTransactions, updatedBanks}=await editExistingTransaction(transaction,newTransaction,transactions,banks);
    updateBanks(updatedBanks);
    updateTransactions(updatedTransactions)
    navigation.pop();
  }
  const handleCancelInput = () => {
    navigation.pop();
  };
  const handleSelectBank = (bank) => {
    setSelectedBank(bank);
    setBankMenu(false);
  };
  const handleSelectCategory = (selectedCategory) => {
    setSelectedCategory(selectedCategory);
    setCategoryMenu(false);
  };
  const handleDateChange = (event, selectedDate) => {
    const dateSelected = selectedDate || currentDate;
    setDate(dateSelected);
    setShowDatePicker(false);
  };
  const handleBankMenuPopUp = (event) => {
    const nativeEvent = event.nativeEvent;
    const anchor = {
      x: nativeEvent.locationX,
      y: nativeEvent.pageY - 85,
    };
    setBankAnchor(anchor);
    setBankMenu(true);
    Keyboard.dismiss();
  };
  const handleCategoryMenuPopUp = () => {
    setCategoryMenu(true);
    Keyboard.dismiss();
  };
  const handleDateInputPopUp = () => {
    setShowDatePicker(true);
    Keyboard.dismiss();
  };
  const toggleOnRecord = () => setCheckOnRecord(!checkOnRecord);
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
      <View style={{ paddingVertical: transaction?(5 * SIZES.padding) / 2:0,flex: 1, backgroundColor: COLORS.white }}>
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
            {transaction?"Edit transaction":"Transaction details"}
          </Text>
        </View>
        <View style={styles.container}>
          <TextInput
            mode="outlined"
            outlineColor={COLORS.primary}
            activeOutlineColor={COLORS.primary}
            label="Description"
            value={description}
            onChangeText={setDescription}
            style={[styles.input, { backgroundColor: COLORS.white }]}
            theme={{ roundness: 30 }}
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
            theme={{ roundness: 30 }}
          />
          <TouchableOpacity onPress={handleBankMenuPopUp}>
          <Button
            onPress={handleBankMenuPopUp}
            style={styles.menuButton}
            textColor={COLORS.black}
          >
            {selectedBank ? selectedBank : "Select Bank"}
          </Button>
          </TouchableOpacity>
          <Menu
            visible={showBankMenu}
            onDismiss={() => setBankMenu(false)}
            theme={menuTheme}
            anchor={bankAnchor}
            style={{ width: 200 }}
          >
            {banks.map((bank) => (
              <Menu.Item
                key={bank.name}
                onPress={() => handleSelectBank(bank.name)}
                title={bank.name}
              />
            ))}
          </Menu>

          <TextInput
            outlineColor={COLORS.primary}
            activeOutlineColor={COLORS.primary}
            mode="outlined"
            label="Date"
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
              maximumDate={currentDate}
            />
          )}
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
          <TouchableOpacity onPress={()=>handleCategoryMenuPopUp()}>
          <Menu
            visible={showCategoryMenu}
            onDismiss={() => setCategoryMenu(false)}
            theme={menuTheme}
            anchor={
              <Button
                onPress={() => handleCategoryMenuPopUp()}
                style={styles.menuButton}
              >
                <Text style={{ color: COLORS.black }}>
                  {selectedCategory ? selectedCategory : "Select Category"}
                </Text>
              </Button>
            }
            style={{ width: 200 }} // Set the background color of the menu
          >
            {categories.map((category) => (
              <Menu.Item
                key={category}
                onPress={() => handleSelectCategory(category)}
                title={category}
              />
            ))}
          </Menu>
          </TouchableOpacity>
          <CheckBox
            checked={checkOnRecord}
            onPress={toggleOnRecord}
            title="On record"
            iconType="material-community"
            checkedIcon="checkbox-marked"
            uncheckedIcon="checkbox-blank-outline"
            checkedColor={COLORS.primary}
          />
          {error ? (
            <Text
              style={{ color: COLORS.red, marginLeft: 10 }}
            >
              {error}
            </Text>
          ) : null}
          {
            transaction?
            (<Button
            mode="contained"
            onPress={handleEditTransaction}
            style={styles.addButton}
          >
            Save
          </Button>):
          (<Button
          mode="contained"
          onPress={handleAddTransaction}
          style={styles.addButton}
        >
          Add transaction
        </Button>)
          }
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
    marginBottom: 15,
    borderRadius: 20,
  },
  addButton: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
  },
  cancelButton: {
    marginTop: 20,
    backgroundColor: "transparent",
    borderRadius: 20,
    color: COLORS.red2,
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
});

export default TransactionInputScreen;

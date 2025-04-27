import React, { useContext, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  Keyboard,
  Image,
} from "react-native";
import { evaluate } from "mathjs";
import {
  TextInput,
  Button,
  Menu,
  Provider,
  DefaultTheme,
} from "react-native-paper";
import { COLORS, SIZES, FONTS, icons } from "../constants";
import { useNavigation, useRoute } from "@react-navigation/native";
import { DataContext } from "../contexts/DataContext";
import { TouchableOpacity } from "react-native";

const TransferInputScreen = () => {
  route = useRoute();
  let transaction = null;
  if (route.params) {
    transaction = route.params.transaction;
  }
  const { banks, transactions, updateTransactions, updateBanks, categories } =
    useContext(DataContext);
  const [amount, setAmount] = useState(
    transaction ? Math.abs(transaction.amount).toString() : "",
  );
  const [selectedCredit, setSelectedCredit] = useState(
    transaction ? Number(transaction.amount > 0) : 0,
  );
  const [checkOnRecord, setCheckOnRecord] = useState(
    transaction ? transaction.on_record > 0 : true,
  );
  const [description, setDescription] = useState(
    transaction ? transaction.title : "",
  );
  const [selectedBank, setSelectedBank] = useState(
    transaction ? transaction.bank_name : null,
  );
  const [selectedFromBank, setSelectedFromBank] = useState(null);
  const [selectedToBank, setSelectedToBank] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(
    transaction ? transaction.parent_category : null,
  );
  const [showBankMenu, setBankMenu] = useState(false);
  const [showFromBankMenu, setFromBankMenu] = useState(false);
  const [showToBankMenu, setToBankMenu] = useState(false);
  const [date, setDate] = useState(
    transaction ? new Date(transaction.date) : new Date(),
  );
  const navigation = useNavigation();
  const [categoryId, setCategoryId] = useState(
    transaction ? transaction.category_id : null,
  );

  const makeTransactionObject = () => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const selectedBankData = banks.find((item) =>
      item.name===selectedBank,
    )
    const formattedDate = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    const signedAmount = selectedCredit == 1 ? amount : -amount;
    const newTransaction = {
      amount: signedAmount,
      title: description,
      on_record: Number(checkOnRecord),
      bank_name: selectedBank,
      date: formattedDate.split("T")[0],
      category: selectedSubcategory ? selectedSubcategory : selectedCategory,
      parent_category: selectedCategory,
      icon_name: categories[categoryId].icon_name,
      icon_type: categories[categoryId].icon_type,
      category_id: categoryId,
      date_with_time: formattedDate,
      bank_id:selectedBankData.id,
    };
    return newTransaction;
  };
  const handleAddTransaction = async () => {
    if (
      !amount.trim() ||
      !description.trim() ||
      selectedBank == null ||
      selectedCategory == null ||
      amount === "Error"
    ) {
      setError("Please fill all the required values.");
      return;
    }
    navigation.pop();
    const newTransaction = makeTransactionObject();
    const { updatedTransactions, updatedBanks } = await addTransaction(
      newTransaction,
      transactions,
      banks,
    );
    updateBanks(updatedBanks);
    updateTransactions(updatedTransactions);
  };

  const handleEditTransaction = async () => {
    if (
      !amount.trim() ||
      !description.trim() ||
      selectedBank == null ||
      selectedCategory == null
    ) {
      setError("Please fill all the required values.");
      return;
    }
    navigation.pop();
    const newTransaction = makeTransactionObject();
    const { updatedTransactions, updatedBanks } = await editExistingTransaction(
      transaction,
      newTransaction,
      transactions,
      banks,
    );
    updateBanks(updatedBanks);
    updateTransactions(updatedTransactions);
  };
  const handleCancelInput = () => {
    navigation.pop();
  };
  const handleSelectBank = (bank) => {
    setSelectedBank(bank);
    setBankMenu(false);
  };
  const handleSelectFromBank = (bank) => {
    setSelectedFromBank(bank);
    setFromBankMenu(false);
  };
  const handleSelectToBank = (bank) => {
    setSelectedToBank(bank);
    setToBankMenu(false);
  };
  const handleBankMenuPopUp = () => {
    setBankMenu(true);
    Keyboard.dismiss();
    handleKeyboardClosing();
  };
  const handleFromBankMenuPopUp = () => {
    setFromBankMenu(true);
    Keyboard.dismiss();
  };
  const handleToBankMenuPopUp = () => {
    setToBankMenu(true);
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
  const handleAmountFcous = () => {
    Keyboard.dismiss();
    setAmount(" ");
    setKeyboardVisible(true);
  };
  const handleKeyboardClosing = () => {
    if (amount === " ") {
      setAmount("");
      setKeyboardVisible(false);
      return;
    }
    if (!amount.trim()) {
      return;
    }
    try {
      const result = evaluate(amount);
      result < 0 ? setAmount("Error") : setAmount(result.toString());
      setKeyboardVisible(false);
    } catch (error) {
      setAmount("Error");
      setKeyboardVisible(false);
    }
  };
  return (
    <Provider>
      <View
        style={{
          paddingTop: SIZES.padding,
          flex: 1,
          backgroundColor: COLORS.white,
        }}
      >
        <View
          style={{
            paddingHorizontal: SIZES.padding,
            paddingTop: (4 * SIZES.padding) / 3,
            backgroundColor: COLORS.white,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: COLORS.white,
            }}
          >
            <TouchableOpacity onPress={handleCancelInput}>
              <Image
                source={icons.back_arrow}
                style={{ width: 30, height: 30, tintColor: COLORS.primary }}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={
                transaction ? handleEditTransaction : handleAddTransaction
              }
            >
              <Image
                source={icons.tick}
                style={{ width: 30, height: 30, tintColor: COLORS.primary }}
              />
            </TouchableOpacity>
          </View>
          <Text
            style={{
              marginLeft: SIZES.padding / 6,
              marginTop: SIZES.padding / 2,
              color: COLORS.primary,
              ...FONTS.h1,
            }}
          >
            {transaction ? "Edit transfer" : "Transfer Amount"}
          </Text>
        </View>
        <View style={styles.container}>

          <TextInput
            mode="outlined"
            outlineColor={COLORS.primary}
            activeOutlineColor={COLORS.primary}
            label={"Amount"}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            style={[styles.input, { backgroundColor: COLORS.white }]}
            theme={{ roundness: 30 }}
          />
          <TouchableOpacity onPress={handleFromBankMenuPopUp}>
            <Menu
              visible={showFromBankMenu}
              onDismiss={() => setFromBankMenu(false)}
              theme={menuTheme}
              anchor={
                <Button
                  onPress={handleFromBankMenuPopUp}
                  style={styles.menuButton}
                  textColor={COLORS.black}
                >
                  {selectedFromBank ? selectedFromBank : "From Bank"}
                </Button>
              }
              style={{ width: 200 }}
            >
              {banks.map((bank) => (
                <Menu.Item
                  key={bank.name}
                  onPress={() => handleSelectFromBank(bank.name)}
                  title={bank.name}
                />
              ))}
            </Menu>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleToBankMenuPopUp}>
            <Menu
              visible={showToBankMenu}
              onDismiss={() => setToBankMenu(false)}
              theme={menuTheme}
              anchor={
                <Button
                  onPress={handleToBankMenuPopUp}
                  style={styles.menuButton}
                  textColor={COLORS.black}
                >
                  {selectedToBank ? selectedToBank : "To Bank"}
                </Button>
              }
              style={{ width: 200 }}
            >
              {banks.map((bank) => (
                <Menu.Item
                  key={bank.name}
                  onPress={() => handleSelectToBank(bank.name)}
                  title={bank.name}
                />
              ))}
            </Menu>
          </TouchableOpacity>
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 20,
  },
  modalContainer: {
    height: 100,
    width: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  modalContent: {
    width: "100%",
    backgroundColor: COLORS.white,
  },
});

export default TransferInputScreen;

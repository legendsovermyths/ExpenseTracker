import React, { useContext, useMemo, useState } from "react";
import { View, StyleSheet, Text } from "react-native";
import { Button, Provider } from "react-native-paper";
import { COLORS, SIZES } from "../constants";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  addTransaction,
  updateTransaction,
} from "../services/_TransactionService";
import HeaderNavigator from "../components/HeaderNavigator";
import HeaderText from "../components/HeaderText";
import AmountInput from "../components/AmountInput";
import DescriptionInput from "../components/DescriptionInput";
import PopupMenu from "../components/PopupMenu";
import DatePicker from "../components/DatePicker";
import CustomCheckbox from "../components/CustomCheckbox";
import {
  CustomKeyboard,
  useCustomKeyboard,
} from "../components/CustomKeyboard";
import { getMainCategories, getSubcategories } from "../services/selectors";
import { useExpensifyStore } from "../store/store";

const TransactionInputScreen = () => {
  let route = useRoute;

  const transaction = route().params?.transaction;
  const accountsById = useExpensifyStore((state) => state.accounts);
  const categoriesById = useExpensifyStore((state) => state.categories);
  const addTransactionToUI = useExpensifyStore((state) => state.addTransaction);
  const updateTransactionInUI = useExpensifyStore(
    (state) => state.updateTransactions,
  );
  const accounts = Object.values(accountsById);
  const categories = Object.values(categoriesById);
  const navigation = useNavigation();
  const mainCategories = getMainCategories(categories);
  const { _expression, onKeyPress, evaluateExpression } = useCustomKeyboard(
    transaction?.amount.toString() || "",
  );
  const [description, setDescription] = useState(
    transaction?.description || "",
  );
  const [amount, setAmount] = useState(transaction?.amount.toString() || "0");
  const [activePopup, setActivePopup] = useState(null);
  const [selectedCredit, setSelectedCredit] = useState(
    transaction?.credit || 0,
  );
  const [selectedBank, setSelectedBank] = useState(
    useExpensifyStore((state) =>
      state.getAccountById(transaction?.account_id),
    ) || {},
  );
  const [selectedCategory, setSelectedCategory] = useState(
    useExpensifyStore((state) =>
      state.getCategoryById(transaction?.category_id),
    ) || null,
  );
  const [selectedSubcategory, setSelectedSubcategory] = useState(
    useExpensifyStore((state) =>
      state.getCategoryById(transaction?.subcategory_id),
    ) || null,
  );
  const [subcategories, setSubcategories] = useState(
    transaction ? getSubcategories(categories, transaction.category_id) : [],
  );
  const [date, setDate] = useState(
    transaction ? new Date(transaction.date_time) : new Date(),
  );
  const [error, setError] = useState(null);
  const currentDate = new Date();

  const handlePopupChange = (popupType) => {
    const amountResult = evaluateExpression();
    setAmount(amountResult);
    setActivePopup(popupType);
  };

  const isPopupActive = (popupType) => activePopup === popupType;

  const makeTransactionObject = () => {
    const newTransaction = {
      id: transaction?.id || null,
      description: description,
      amount: Number(amount),
      is_credit: Boolean(selectedCredit),
      account_id: selectedBank.id,
      category_id: selectedCategory.id,
      subcategory_id: selectedSubcategory ? selectedSubcategory.id : null,
      date_time: date.toISOString(),
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
    const transaction = makeTransactionObject();
    const addedTransaction = await addTransaction(transaction);
    addTransactionToUI(addedTransaction);
    navigation.pop();
  };

  const handleEditTransaction = async () => {
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
    const updatedTransaction = await updateTransaction(newTransaction);
    updateTransactionInUI(updatedTransaction);
  };

  const handleCancelInput = () => {
    navigation.pop();
  };

  const handleSelectBank = (account) => {
    setSelectedBank(account);
    handlePopupChange("None");
  };

  const handleSelectCategory = (category) => {
    setSelectedCategory(category);
    setSubcategories(getSubcategories(categories, category.id));
    setSelectedSubcategory(null);
    handlePopupChange("None");
  };

  const handleSelectSubcategory = (category) => {
    setSelectedSubcategory(category);
    handlePopupChange("None");
  };

  const handleDateChange = (selectedDate) => {
    const dateSelected = selectedDate || currentDate;
    setDate(dateSelected);
    handlePopupChange("None");
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
          <HeaderNavigator
            onBackPress={handleCancelInput}
            onTickPress={
              transaction ? handleEditTransaction : handleAddTransaction
            }
          />
          <HeaderText
            text={transaction ? "Edit Transaction" : "Add New Transaction"}
          />
        </View>
        <View style={styles.container}>
          <DescriptionInput
            label="Description"
            value={description}
            onFocus={() => handlePopupChange("None")}
            onChangeValue={setDescription}
          />
          <AmountInput
            keyboardVisible={isPopupActive("customKeyboard")}
            setKeyboardVisible={() => handlePopupChange("customKeyboard")}
            value={amount}
            setValue={setAmount}
          />
          <PopupMenu
            visible={isPopupActive("bankMenu")}
            onDismiss={() => handlePopupChange("None")}
            anchorText={selectedBank.name || "Select Bank"}
            onOpen={() => handlePopupChange("bankMenu")}
            items={accounts.map((account) => ({
              key: account.name,
              title: account.name,
              onPress: () => {
                handleSelectBank(account);
              },
            }))}
          />
          <DatePicker
            onDateChange={handleDateChange}
            maximumDate={currentDate}
            value={date}
            visible={isPopupActive("datePicker")}
            onTouchStart={() => handlePopupChange("datePicker")}
            position={{ top: 432, left: 22 }}
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
          <PopupMenu
            anchorText={
              selectedCategory ? selectedCategory.name : "Select Category"
            }
            visible={isPopupActive("categoryMenu")}
            onOpen={() => handlePopupChange("categoryMenu")}
            onDismiss={() => handlePopupChange("None")}
            items={mainCategories.map((category) => ({
              key: category.id,
              onPress: () => handleSelectCategory(category),
              title: category.name,
            }))}
          />
          {subcategories.length > 0 ? (
            <PopupMenu
              anchorText={
                selectedSubcategory
                  ? selectedSubcategory.name
                  : "Select SubCategory (optional)"
              }
              visible={isPopupActive("subCategoryMenu")}
              onOpen={() => handlePopupChange("subCategoryMenu")}
              onDismiss={() => handlePopupChange("None")}
              items={subcategories.map((category) => ({
                key: category.id,
                onPress: () => handleSelectSubcategory(category),
                title: category.name,
              }))}
            />
          ) : null}
          {error ? (
            <Text style={{ color: COLORS.red, marginLeft: 10 }}>{error}</Text>
          ) : null}
          {transaction ? (
            <Button
              mode="contained"
              onPress={handleEditTransaction}
              style={styles.addButton}
            >
              Save
            </Button>
          ) : (
            <Button
              mode="contained"
              onPress={handleAddTransaction}
              style={styles.addButton}
            >
              Add Transaction
            </Button>
          )}
        </View>
        {isPopupActive("customKeyboard") ? (
          <View style={styles.modalContent}>
            <CustomKeyboard
              onKeyPress={(key) => {
                if (key === "Done") {
                  handlePopupChange("None");
                }
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
    position: "relative",
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

export default TransactionInputScreen;

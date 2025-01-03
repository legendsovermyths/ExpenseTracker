import React, { useContext, useState } from "react";
import { View, StyleSheet, Text } from "react-native";
import { Button, Provider } from "react-native-paper";
import { COLORS, SIZES  } from "../constants";
import { useNavigation, useRoute } from "@react-navigation/native";
import { DataContext } from "../contexts/DataContext";
import {
  addTransaction,
  editExistingTransaction,
} from "../services/TransactionService";
import {
  convertAndFilterUndeletedAndMainCategories,
  getCategoryObjectsWithParent,
} from "../services/CategoryService";
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

const TransactionInputScreen = () => {
  let route = useRoute
  let transaction = null;
  if (route.params) {
    transaction = route.params.transaction;
  }
  const { banks, transactions, updateTransactions, updateBanks, categories } =
    useContext(DataContext);
  const mainCategories = convertAndFilterUndeletedAndMainCategories(categories);
  const [amount, setAmount] = useState(
    transaction ? Math.abs(transaction.amount).toString() : "",
  );
  const { _expression, onKeyPress, evaluateExpression } = useCustomKeyboard();
  const [activePopup, setActivePopup] = useState(null);
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
  const [selectedCategory, setSelectedCategory] = useState(
    transaction ? transaction.parent_category : null,
  );
  const [selectedSubcategory, setSelectedSubcategory] = useState(
    transaction && transaction.category != transaction.parent_category
      ? transaction.category
      : null,
  );
  const [subcategories, setSubcategories] = useState(
    transaction
      ? getCategoryObjectsWithParent(categories, transaction.parent_category)
      : null,
  );
  const [date, setDate] = useState(
    transaction ? new Date(transaction.date) : new Date(),
  );
  const [error, setError] = useState(null);
  const currentDate = new Date();
  const navigation = useNavigation();
  const [categoryId, setCategoryId] = useState(
    transaction ? transaction.category_id : null,
  );

  const handlePopupChange = (popupType) => {
    const amountResult = evaluateExpression();
    setAmount(amountResult);
    setActivePopup(popupType);
  };
  const isPopupActive = (popupType) => activePopup === popupType;
  const makeTransactionObject = () => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const selectedBankData = banks.find((item) => item.name === selectedBank);
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
      bank_id: selectedBankData.id,
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
    handlePopupChange("None");
  };
  const handleSelectCategory = (selectedCategory, id) => {
    setCategoryId(id);
    setSelectedCategory(selectedCategory);
    const subcategories = getCategoryObjectsWithParent(
      categories,
      selectedCategory,
    );
    if (Object.keys(subcategories).length > 0) {
      setSubcategories(subcategories);
    } else setSubcategories(null);
    setSelectedSubcategory(null);
    handlePopupChange("None");
  };
  const handleSelectSubcategory = (selectedSubcategory, id) => {
    setCategoryId(id);
    setSelectedSubcategory(selectedSubcategory);
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
            onFocus={()=>handlePopupChange("None")}
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
            anchorText={selectedBank || "Select Bank"}
            onOpen={() => handlePopupChange("bankMenu")}
            items={banks.map((bank) => ({
              key: bank.name,
              title: bank.name,
              onPress: () => {
                handleSelectBank(bank.name);
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
            anchorText={selectedCategory ? selectedCategory : "Select Category"}
            visible={isPopupActive("categoryMenu")}
            onOpen={() => handlePopupChange("categoryMenu")}
            onDismiss={() => handlePopupChange("None")}
            items={mainCategories.map((category) => ({
              key: category.id,
              onPress: () => handleSelectCategory(category.name, category.id),
              title: category.name,
            }))}
          />
          {subcategories ? (
            <PopupMenu
              anchorText={
                selectedSubcategory
                  ? selectedSubcategory
                  : "Select SubCategory (optional)"
              }
              visible={isPopupActive("subCategoryMenu")}
              onOpen={() => handlePopupChange("subCategoryMenu")}
              onDismiss={() => handlePopupChange("None")}
              items={subcategories.map((category) => ({
                key: category.id,
                onPress: () =>
                  handleSelectSubcategory(category.name, category.id),
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

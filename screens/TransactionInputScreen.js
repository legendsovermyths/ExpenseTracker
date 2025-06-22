import React, { useContext, useRef, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  Keyboard,
  TouchableOpacity,
} from "react-native";
import { Button, Provider } from "react-native-paper";
import { COLORS, SIZES } from "../constants";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  addTransaction,
  updateTransaction,
  deleteTransaction,
} from "../services/_TransactionService";
import HeaderNavigator from "../components/HeaderNavigator";
import CategoryBottomSheet from "../components/CategoryBottomSheet";
import HeaderText from "../components/HeaderText";
import AmountInput from "../components/AmountInput";
import PopupMenu from "../components/PopupMenu";
import DatePicker from "../components/DatePicker";
import CustomCheckbox from "../components/CustomCheckbox";
import {
  CustomKeyboard,
  useCustomKeyboard,
} from "../components/CustomKeyboard";
import { getMainCategories, getSubcategories } from "../services/selectors";
import { useExpensifyStore } from "../store/store";
import DescriptionAutocompleteInput from "../components/DescriptionAutoCompleteInput";
import { linkTransactionToLedgerEntry } from "../services/Splits";

const TransactionInputScreen = () => {
  let route = useRoute;

  const catSheetRef = useRef(null);
  const transaction = route().params?.transaction;
  const entryId = route().params?.entryId;
  const mode = route().params?.mode;
  const accountsById = useExpensifyStore((state) => state.accounts);
  const categoriesById = useExpensifyStore((state) => state.categories);
  const addTransactionToUI = useExpensifyStore((state) => state.addTransaction);
  const updateTransactionInUI = useExpensifyStore(
    (state) => state.updateTransactions,
  );
  const deleteTransactionFromUI = useExpensifyStore(
    (state) => state.deleteTransaction,
  );
  const accounts = Object.values(accountsById);
  const allCategories = Object.values(categoriesById);
  const categories = allCategories.filter(
    (category) => category.is_deleted == false,
  );
  const navigation = useNavigation();
  const { _expression, onKeyPress, evaluateExpression } = useCustomKeyboard(
    transaction?.amount?.toString() || "",
  );
  const [description, setDescription] = useState(
    transaction?.description || "",
  );
  const [amount, setAmount] = useState(transaction?.amount?.toString() || "0");
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
  const transactions = useExpensifyStore((s) => s.transactions);

  const suggestions = useMemo(() => {
    const uniq = new Set();
    Object.values(transactions).forEach((t) => {
      const d = t.description?.trim();
      if (d) uniq.add(d);
    });
    return Array.from(uniq);
  }, [transactions]);
  const currentDate = new Date();
  const handlePopupChange = (popupType) => {
    if(popupType === "None") {
      catSheetRef.current?.close();
      setActivePopup(popupType);
      return;
    }
    const amountResult = evaluateExpression();
    setAmount(amountResult);
    catSheetRef.current?.close();
    Keyboard.dismiss();
    setActivePopup(popupType);
  };

  const isPopupActive = (popupType) => activePopup === popupType;

  const makeTransactionObject = () => {
    const newAmount = evaluateExpression();
    const newTransaction = {
      id: transaction?.id || null,
      description: description,
      amount: Number(newAmount),
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
    if (entryId) {
      await linkTransactionToLedgerEntry(addedTransaction.id, entryId);
    }
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

  const handleDeleteTransaction = async () => {
    try {
      await deleteTransaction(transaction);
      deleteTransactionFromUI(transaction.id);
      navigation.pop();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      setError("Failed to delete transaction.");
    }
  };

  const handleCancelInput = () => {
    navigation.pop();
  };

  const handleSelectBank = (account) => {
    setSelectedBank(account);
    handlePopupChange("None");
  };

  const handleSelectCategory = (category) => {
    if (category.is_subcategory) {
      setSelectedSubcategory(category);
      handlePopupChange("None");
    } else {
      setSelectedCategory(category);
      setSubcategories(getSubcategories(categories, category.id));
      setSelectedSubcategory(null);
    }
  };

  const handleDateChange = (selectedDate) => {
    const rawDate = selectedDate ? new Date(selectedDate) : new Date();

    const now = new Date();
    rawDate.setHours(
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getMilliseconds(),
    );

    setDate(rawDate);
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
              mode === "edit" ? handleEditTransaction : handleAddTransaction
            }
          />
          <HeaderText
            text={mode === "edit" ? "Edit Transaction" : "Add New Transaction"}
          />
        </View>
        <View style={styles.container}>
          <DescriptionAutocompleteInput
            label="Description"
            value={description}
            onChangeValue={setDescription}
            onFocus={() => handlePopupChange("None")}
            suggestions={suggestions}
            onPickSuggestion={(t) => {
            }}
          />
          <AmountInput
            keyboardVisible={isPopupActive("customKeyboard")}
            setKeyboardVisible={() => handlePopupChange("customKeyboard")}
            value={amount}
            setValue={setAmount}
            onFocus={() => handlePopupChange("customKeyboard")}
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
          <TouchableOpacity
            onPress={() => {
              handlePopupChange("categorySheet");
              catSheetRef.current?.open();
            }}
          >
            <Button
              onPress={() => {
                handlePopupChange("categorySheet");
                catSheetRef.current?.open();
              }}
              style={styles.menuButtonStyle}
              textColor={COLORS.black}
            >
              {selectedCategory
                ? selectedCategory.name +
                  (selectedSubcategory ? " → " + selectedSubcategory.name : "")
                : "Select Category"}
            </Button>
          </TouchableOpacity>

          <CategoryBottomSheet
            ref={catSheetRef}
            categories={categories} // or one unified list from store
            onSelect={handleSelectCategory}
          />
          {error ? (
            <Text style={{ color: COLORS.red, marginLeft: 10 }}>{error}</Text>
          ) : null}
          {mode === "edit" ? (
            <>
              <Button
                mode="contained"
                onPress={handleEditTransaction}
                style={styles.addButton}
              >
                Save
              </Button>
              <Button
                mode="outlined"
                icon="delete-outline"
                onPress={handleDeleteTransaction}
                style={styles.deleteButton}
                textColor={COLORS.red2}
                labelStyle={styles.deleteButtonText}
              >
                Delete Transaction
              </Button>
            </>
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
                  return;
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
  deleteButton: {
    marginTop: 15,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: "normal",
  },
  cancelButton: {
    marginTop: 20,
    backgroundColor: "transparent",
    borderRadius: 20,
    color: COLORS.red2,
  },
  menuButtonStyle: {
    borderColor: COLORS.primary,
    borderRadius: 30,
    borderWidth: 1,
    backgroundColor: COLORS.white,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 15,
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

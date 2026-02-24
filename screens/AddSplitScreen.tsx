import React, { useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Keyboard,
  InteractionManager,
} from "react-native";
import { Button, Provider, DefaultTheme } from "react-native-paper";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  BottomSheetModal,
  BottomSheetModalProvider,
} from "@gorhom/bottom-sheet";
import { SIZES } from "../constants";
import HeaderNavigator from "../components/HeaderNavigator";
import HeaderText from "../components/HeaderText";
import AmountInput from "../components/AmountInput";
import { useTheme } from "../contexts/ThemeContext";
import {
  CustomKeyboard,
  useCustomKeyboard,
} from "../components/CustomKeyboard";
import { SplitPayload } from "../types/splits/SplitPayload";
import { useExpensifyStore } from "../store/store";
import { CheckBox } from "@rneui/themed";
import DatePicker from "../components/DatePicker";
import PopupMenu from "../components/PopupMenu";
import { getMainCategories, getSubcategories } from "../services/selectors";
import { addTransaction } from "../services/_TransactionService";
import CustomSplitEditor from "../components/CustomSplitEditor";
import {
  addSplitData,
  linkTransactionToLedgerEntry,
  updateUserBalances,
} from "../services/Splits";
import DescriptionAutocompleteInput from "../components/DescriptionAutoCompleteInput";
import CategoryBottomSheet from "../components/CategoryBottomSheet";
import uuid from "react-native-uuid";
import { LedgerEntryRow } from "../types/entity/LedgerEntryRow";
import { LineItemRow } from "../types/entity/LineItemRow";
import { Account } from "../types/entity/Account";

// Helper function to convert rupees to cents, handling floating point precision
const rupeesToCents = (rupees: number | string): number => {
  const num = typeof rupees === "string" ? parseFloat(rupees) : rupees;
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
};

// Helper function to convert cents to rupees for display
const centsToRupees = (cents: number): number => {
  return cents / 100;
};

function getNowTimestamp() {
  return new Date().toISOString();
}
export type SplitType =
  | "ME_PAY_EQUAL"
  | "OTHER_PAY_EQUAL"
  | "ME_OWE_ALL"
  | "OTHER_OWE_ALL";
const SplitInputScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const route = useRoute<any>();
  const { userId: otherUserId, userName } = route.params as {
    userId: string;
    userName: string;
  };
  const navigation: any = useNavigation();
  const [addSplitPayload, setAddSplitPayload] = useState<SplitPayload>({
    meOwe: 0,
    mePay: 0,
    friendPay: 0,
    frinedOwe: 0,
  });
  const categoriesById = useExpensifyStore((state) => state.categories);
  const accountsById = useExpensifyStore((state) => state.accounts);
  const allAccounts = Object.values(accountsById);
  const allCategories = Object.values(categoriesById);
  const categories = allCategories.filter(
    (category) => category.is_deleted == false,
  );
  const accounts = allAccounts.filter((item) => item.is_deleted == false);
  const transactions = useExpensifyStore((state) => state.transactions);
  const [description, setDescription] = useState<string>("");
  const [amount, setAmount] = useState<string>("0");
  const [activePopup, setActivePopup] = useState<string | null>(null);
  const [selectedSplitType, setSelectedSplitType] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setUserBalancesInUI = useExpensifyStore(
    (state) => state.setUserBalances,
  );
  const [addToTransaction, setAddToTransaction] = useState(false);
  const me = useExpensifyStore((state) => state.getUserId());
  const catSheetRef = useRef(null);
  const userBalancesById = useExpensifyStore((state) => state.userbalances);
  const { onKeyPress, evaluateExpression } = useCustomKeyboard("");
  const addTransactionToUI = useExpensifyStore((state) => state.addTransaction);
  const [subcategories, setSubcategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [date, setDate] = useState(new Date());
  const [selectedBank, setSelectedBank] = useState<Account>(null);
  const suggestions: any = useMemo(() => {
    const uniq = new Set();
    Object.values(transactions).forEach((t) => {
      const d = t.description?.trim();
      if (d) uniq.add(d);
    });
    return Array.from(uniq);
  }, [transactions]);
  const currentDate = new Date();
  const isPopupActive = (popup: string) => activePopup === popup;
  const handlePopupChange = (popup: string) => {
    if (popup === "None") {
      catSheetRef.current?.close();
      bottomSheetModalRef.current?.dismiss();
      customSheetRef.current?.dismiss();
      setActivePopup(popup);
      return;
    }

    // Always evaluate and set amount when changing popups
    const result = evaluateExpression();
    setAmount(result);

    // Close all potential popups first
    catSheetRef.current?.close();
    bottomSheetModalRef.current?.dismiss();
    customSheetRef.current?.dismiss();
    Keyboard.dismiss();

    // Set the new active popup
    setActivePopup(popup);
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

  const makeTransactionObject = () => {
    const newTransaction = {
      id: null,
      description: description,
      amount: centsToRupees(addSplitPayload.meOwe), // Convert back to rupees for transaction
      is_credit: false,
      account_id: selectedBank.id,
      category_id: selectedCategory.id,
      subcategory_id: selectedSubcategory ? selectedSubcategory.id : null,
      date_time: date.toISOString(),
    };
    return newTransaction;
  };

  const handleAddTransaction = async () => {
    const transaction = makeTransactionObject();
    const addedTransaction = await addTransaction(transaction);
    addTransactionToUI(addedTransaction);
    return addedTransaction;
  };
  const handleSelectBank = (account) => {
    setSelectedBank(account);
    handlePopupChange("None");
  };
  const handleSelectSplitType = (type: SplitType) => {
    let splitPayload: SplitPayload;
    const parsedAmountCents = rupeesToCents(amount);

    switch (type) {
      case "ME_PAY_EQUAL": {
        const halfCents = Math.floor(parsedAmountCents / 2);
        // Handle odd amounts by giving the extra cent to meOwe
        const remainderCents = parsedAmountCents - halfCents * 2;
        splitPayload = {
          mePay: parsedAmountCents,
          friendPay: 0,
          meOwe: halfCents + remainderCents,
          frinedOwe: halfCents,
        };
        break;
      }
      case "OTHER_PAY_EQUAL": {
        const halfCents = Math.floor(parsedAmountCents / 2);
        // Handle odd amounts by giving the extra cent to meOwe
        const remainderCents = parsedAmountCents - halfCents * 2;
        splitPayload = {
          mePay: 0,
          friendPay: parsedAmountCents,
          meOwe: halfCents + remainderCents,
          frinedOwe: halfCents,
        };
        break;
      }
      case "ME_OWE_ALL": {
        splitPayload = {
          mePay: parsedAmountCents,
          friendPay: 0,
          meOwe: 0,
          frinedOwe: parsedAmountCents,
        };
        break;
      }
      case "OTHER_OWE_ALL": {
        splitPayload = {
          mePay: 0,
          friendPay: parsedAmountCents,
          meOwe: parsedAmountCents,
          frinedOwe: 0,
        };
        break;
      }
    }
    setAddSplitPayload(splitPayload);
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

  const addSplit = async () => {
    try {
      if (!description.trim() || !selectedSplitType.trim()) {
        setError("Please fill in all the required details");
        return;
      }
      if (
        addToTransaction &&
        (!amount.trim() ||
          !description.trim() ||
          selectedBank == null ||
          selectedCategory == null ||
          amount === "Error")
      ) {
        setError("Please fill all the required values.");
        return;
      }

      // Convert amount to cents for precise calculation
      const amountCents = rupeesToCents(amount);
      if (amountCents <= 0) throw new Error("Invalid amount");

      let ledgerEntry: LedgerEntryRow = {
        id: uuid.v4(),
        created_at: getNowTimestamp(),
        updated_at: getNowTimestamp(),
        kind: "SPLIT",
        is_deleted: false,
        description,
        created_by: me,
        total_cents: amountCents,
      };

      const entryId = ledgerEntry.id as string;
      let lineItems: LineItemRow[] = [
        {
          entry_id: entryId,
          user_id: me,
          amount_cents: addSplitPayload.mePay - addSplitPayload.meOwe,
          paid_cents: addSplitPayload.mePay,
          owed_cents: addSplitPayload.meOwe,
          updated_at: getNowTimestamp(),
        },
        {
          updated_at: getNowTimestamp(),
          entry_id: entryId,
          user_id: otherUserId,
          amount_cents: addSplitPayload.friendPay - addSplitPayload.frinedOwe,
          paid_cents: addSplitPayload.friendPay,
          owed_cents: addSplitPayload.frinedOwe,
        },
      ];

      await addSplitData([ledgerEntry], lineItems);
      if (addToTransaction) {
        let addedTransaction = await handleAddTransaction();
        await linkTransactionToLedgerEntry(addedTransaction.id, entryId);
      }
      let userBalances = { ...userBalancesById };
      userBalances = {
        ...userBalances,
        [otherUserId]: {
          ...userBalances[otherUserId],
          net_cents:
            userBalances[otherUserId].net_cents +
            addSplitPayload.frinedOwe -
            addSplitPayload.friendPay,
        },
      };
      await updateUserBalances(Object.values(userBalances));
      setUserBalancesInUI(Object.values(userBalances));
      navigation.pop();
    } catch (err) {}
  };
  const amtFloat = parseFloat(amount) || 0;
  const half = amtFloat / 2;
  const options = [
    {
      key: "ME_PAY_EQUAL",
      title: "You paid, split equally",
      subtitle: `${userName} owes you ₹${half.toFixed(2)}`,
    },
    {
      key: "ME_OWE_ALL",
      title: "You are owed the full amount",
      subtitle: `${userName} owes you ₹${amtFloat.toFixed(2)}`,
    },
    {
      key: "OTHER_PAY_EQUAL",
      title: `${userName} paid, split equally`,
      subtitle: `You owe ${userName} ₹${half.toFixed(2)}`,
    },
    {
      key: "OTHER_OWE_ALL",
      title: `${userName} paid, you owe the full amount`,
      subtitle: `You owe ${userName} ₹${amtFloat.toFixed(2)}`,
    },
    {
      key: "CUSTOM",
      title: "Custom Split",
    },
  ];
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const customSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = ["45%"]; // main picker
  const customSnap = ["95%"]; // custom split editor
  const openSheet = () => {
    handlePopupChange("splitTypeSheet");
    bottomSheetModalRef.current?.present();
  };
  const closeSheet = () => bottomSheetModalRef.current?.dismiss();

  const styles = React.useMemo(() => createStyles(COLORS), [COLORS]);

  return (
    <BottomSheetModalProvider>
      <Provider>
        <View style={styles.wrapper}>
          <View style={styles.headerContainer}>
            <HeaderNavigator
              onBackPress={() => navigation.goBack()}
              onTickPress={() => addSplit()}
            />
            <HeaderText text="Add New Split" />
            <Text style={styles.subheading}>{userName}</Text>
          </View>
          <View style={styles.container}>
            <DescriptionAutocompleteInput
              label="Description"
              value={description}
              onChangeValue={setDescription}
              onFocus={() => handlePopupChange("None")}
              suggestions={suggestions}
              onPickSuggestion={(t) => {
                handlePopupChange("None");
              }}
            />
            <AmountInput
              keyboardVisible={isPopupActive("customKeyboard")}
              setKeyboardVisible={() => handlePopupChange("customKeyboard")}
              value={amount}
            />
            <Button
              mode="outlined"
              onPress={openSheet}
              style={styles.menuButtonStyle}
              textColor={COLORS.primary}
            >
              {options.find((o) => o.key === selectedSplitType)?.title ||
                "Select Split Type"}
            </Button>

            <CheckBox
              title={"Add To Transaction"}
              checked={addToTransaction}
              onPress={() => setAddToTransaction(!addToTransaction)}
              iconType="material-community"
              checkedIcon="checkbox-marked"
              uncheckedIcon="checkbox-blank-outline"
              checkedColor={COLORS.primary}
            />
            {addToTransaction ? (
              <View>
                <DatePicker
                  onDateChange={handleDateChange}
                  maximumDate={currentDate}
                  value={date}
                  visible={isPopupActive("datePicker")}
                  onTouchStart={() => handlePopupChange("datePicker")}
                  position={{ top: 432, left: 22 }}
                />

                <PopupMenu
                  visible={isPopupActive("bankMenu")}
                  onDismiss={() => handlePopupChange("None")}
                  anchorText={selectedBank ? selectedBank.name : "Select Bank"}
                  onOpen={() => handlePopupChange("bankMenu")}
                  items={accounts.map((account) => ({
                    key: account.name,
                    title: account.name,
                    onPress: () => {
                      handleSelectBank(account);
                    },
                  }))}
                />
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
                        (selectedSubcategory
                          ? " → " + selectedSubcategory.name
                          : "")
                      : "Select Category"}
                  </Button>
                </TouchableOpacity>
                <CategoryBottomSheet
                  ref={catSheetRef}
                  categories={categories} // or one unified list from store
                  onSelect={handleSelectCategory}
                />
              </View>
            ) : null}
            {error && <Text style={styles.errorText}>{error}</Text>}
            <Button
              mode="contained"
              onPress={addSplit}
              style={styles.addButton}
              loading={loading}
            >
              Add Split
            </Button>
          </View>
          <BottomSheetModal
            ref={bottomSheetModalRef}
            snapPoints={snapPoints}
            backgroundStyle={{ borderRadius: 30 }}
          >
            <View>
              {options.map((opt) =>
                opt.key == "CUSTOM" ? null : (
                  <TouchableOpacity
                    key={opt.key}
                    style={styles.optionRow}
                    onPress={() => {
                      handleSelectSplitType(opt.key as SplitType);
                      setSelectedSplitType(opt.key as SplitType);
                      handlePopupChange("None");
                    }}
                  >
                    <Text style={styles.optionTitle}>{opt.title}</Text>
                    <Text style={styles.optionSub}>{opt.subtitle}</Text>
                  </TouchableOpacity>
                ),
              )}
              <TouchableOpacity
                onPress={() => {
                  handlePopupChange("customSplitSheet");
                  customSheetRef.current.present();
                }}
              >
                <Text
                  style={{
                    textAlign: "center",
                    color: COLORS.darkgray,
                    marginTop: SIZES.padding,
                  }}
                >
                  more options
                </Text>
              </TouchableOpacity>
            </View>
          </BottomSheetModal>
          <BottomSheetModal
            ref={customSheetRef}
            snapPoints={customSnap}
            backgroundStyle={{ borderRadius: 30 }}
          >
            <CustomSplitEditor
              total={parseFloat(amount) || 0}
              meName="You"
              friendName={userName}
              onDone={(pMe, pFr, oMe, oFr) => {
                // Convert the returned rupee values to cents
                setAddSplitPayload({
                  meOwe: rupeesToCents(oMe),
                  frinedOwe: rupeesToCents(oFr),
                  mePay: rupeesToCents(pMe),
                  friendPay: rupeesToCents(pFr),
                });
                setSelectedSplitType("CUSTOM");
                customSheetRef.current?.dismiss();
              }}
            />
          </BottomSheetModal>

          {isPopupActive("customKeyboard") ? (
            <View style={styles.modalContent}>
              <CustomKeyboard
                onKeyPress={(key) => {
                  if (key === "Done") {
                    handlePopupChange("None");
                    return;
                  }
                  setSelectedSplitType("");
                  setAddSplitPayload({
                    meOwe: 0,
                    mePay: 0,
                    friendPay: 0,
                    frinedOwe: 0,
                  });
                  const result: any = onKeyPress(key);
                  setAmount(result);
                }}
              />
            </View>
          ) : null}
        </View>
      </Provider>
    </BottomSheetModalProvider>
  );
};

const createStyles = (COLORS: any) => StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingTop: SIZES.padding,
  },
  headerContainer: {
    paddingHorizontal: SIZES.padding,
    paddingTop: (4 * SIZES.padding) / 3,
    backgroundColor: COLORS.white,
  },
  subheading: {
    paddingHorizontal: SIZES.padding / 5,
    color: COLORS.darkgray,
    fontSize: 16,
  },
  container: {
    flex: 1,
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding / 1.5,
    backgroundColor: COLORS.white,
  },
  addButton: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
  },
  modalContent: {
    position: "absolute",
    marginTop: 500,
    width: "100%",
    backgroundColor: COLORS.white,
    borderRadius: 40,
  },
  errorText: {
    color: COLORS.red,
    marginLeft: 10,
  },
  menuStyle: {
    width: 300,
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
  optionRow: { padding: 16 },
  optionTitle: { fontSize: 16, color: COLORS.primary },
  optionSub: { fontSize: 13, color: COLORS.darkgray, marginTop: 2 },
  tabRow: { flexDirection: "row", justifyContent: "center", marginBottom: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 6,
    marginHorizontal: 16,
    paddingHorizontal: 8,
  },
  label: { fontSize: 16, color: COLORS.primary },
  input: {
    borderBottomWidth: 1,
    borderColor: COLORS.darkgray,
    width: 100,
    textAlign: "right",
    fontSize: 16,
  },
  remaining: { textAlign: "center", color: COLORS.darkgray, marginTop: 4 },

  subTabRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 8,
  },
  subTab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
  },
  subTabActive: {
    backgroundColor: COLORS.primary,
  },
});

export default SplitInputScreen;

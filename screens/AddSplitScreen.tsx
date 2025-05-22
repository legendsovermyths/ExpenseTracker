import React, { useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Keyboard,
} from "react-native";
import {
  Button,
  Provider,
  Menu,
  DefaultTheme,
  TextInput,
  Checkbox,
} from "react-native-paper";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  BottomSheetModal,
  BottomSheetModalProvider,
} from "@gorhom/bottom-sheet";
import { COLORS, SIZES } from "../constants";
import HeaderNavigator from "../components/HeaderNavigator";
import HeaderText from "../components/HeaderText";
import AmountInput from "../components/AmountInput";
import DescriptionInput from "../components/DescriptionInput";
import {
  CustomKeyboard,
  useCustomKeyboard,
} from "../components/CustomKeyboard";
import { supabase } from "../services/Supabase";
import { SplitPayload } from "../types/splits/SplitPayload";
import { add } from "mathjs";
import { requestSync } from "../services/BackgroundSync";
import { Appconstant } from "../types/entity/Appconstant";
import { useExpensifyStore } from "../store/store";
import { updateAppconstant } from "../services/Appconstants";
import { CheckBox } from "@rneui/themed";
import DatePicker from "../components/DatePicker";
import PopupMenu from "../components/PopupMenu";
import { getMainCategories, getSubcategories } from "../services/selectors";
import { addTransaction } from "../services/_TransactionService";
import { Transaction } from "../types/entity/Transaction";
import { linkTransactionToLedgerEntry } from "../services/Splits";
import DescriptionAutocompleteInput from "../components/DescriptionAutoCompleteInput";
const menuTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: COLORS.primary,
    secondary: COLORS.gray,
    primaryContainer: COLORS.gray,
    secondaryContainer: COLORS.gray,
    surfaceVariant: COLORS.lightGray2,

    elevation: {
      ...DefaultTheme.colors.elevation,
      level2: COLORS.white,
    },
  },
};
interface CSEProps {
  total: number; // rupees
  meName: string;
  friendName: string;
  onDone: (
    paidMe: number,
    paidFriend: number,
    oweMe: number,
    oweFriend: number,
  ) => void;
}
const CustomSplitEditor: React.FC<CSEProps> = ({
  total,
  meName,
  friendName,
  onDone,
}) => {
  const [tab, setTab] = useState<"paid" | "owed">("owed");
  const [paidMe, setPaidMe] = useState<number>(total);
  const [paidFriend, setPaidFriend] = useState<number>(0);
  const [oweMe, setOweMe] = useState<number>(total / 2);
  const [oweFriend, setOweFriend] = useState<number>(total / 2);

  const remainingPaid = total - (paidMe + paidFriend);
  const remainingOwed = total - (oweMe + oweFriend);

  const numInput = (
    value: number,
    setValue: React.Dispatch<React.SetStateAction<number>>,
  ) => (
    <TextInput
      activeOutlineColor={COLORS.primary}
      outlineColor={COLORS.primary}
      keyboardType="decimal-pad"
      value={value.toString()}
      onChangeText={(t) => setValue(Number(t) || 0)}
      style={styles.input}
      theme={menuTheme}
    />
  );

  const renderPaid = () => (
    <>
      <View style={styles.row}>
        <Text style={styles.label}>{meName} paid</Text>
        {numInput(paidMe, setPaidMe)}
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{friendName} paid</Text>
        {numInput(paidFriend, setPaidFriend)}
      </View>
      <Text style={styles.remaining}>
        Amount remaining: ₹{remainingPaid.toFixed(2)}
      </Text>
    </>
  );

  const renderOwed = () => (
    <>
      <View style={styles.row}>
        <Text style={styles.label}>{meName} owe</Text>
        {numInput(oweMe, setOweMe)}
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{friendName} owes</Text>
        {numInput(oweFriend, setOweFriend)}
      </View>
      <Text style={styles.remaining}>
        Amount remaining: ₹{remainingOwed.toFixed(2)}
      </Text>
    </>
  );

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <View style={styles.tabRow}>
        <Button
          mode={tab === "paid" ? "contained" : "text"}
          onPress={() => setTab("paid")}
          textColor={tab === "paid" ? COLORS.white : COLORS.primary}
          buttonColor={tab === "paid" ? COLORS.primary : COLORS.white}
          style={{ marginRight: SIZES.padding / 2 }}
        >
          Paid amount
        </Button>
        <Button
          mode={tab === "owed" ? "contained" : "text"}
          textColor={tab === "owed" ? COLORS.white : COLORS.primary}
          buttonColor={tab === "owed" ? COLORS.primary : COLORS.white}
          onPress={() => setTab("owed")}
          style={{ marginLeft: SIZES.padding / 2 }}
        >
          Owed amount
        </Button>
      </View>
      {tab === "paid" ? renderPaid() : renderOwed()}
      <Button
        mode="contained"
        buttonColor={COLORS.primary}
        style={{ marginTop: 16, borderRadius: 20 }}
        onPress={() => onDone(paidMe, paidFriend, oweMe, oweFriend)}
        disabled={remainingPaid !== 0 || remainingOwed !== 0}
      >
        Done
      </Button>
    </View>
  );
};
export type SplitType =
  | "ME_PAY_EQUAL"
  | "OTHER_PAY_EQUAL"
  | "ME_OWE_ALL"
  | "OTHER_OWE_ALL";
const SplitInputScreen: React.FC = () => {
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
  const categories = Object.values(categoriesById);
  const accountsById = useExpensifyStore((state) => state.accounts);
  const accounts = Object.values(accountsById);
  const transactions = useExpensifyStore((state) => state.transactions);
  const [description, setDescription] = useState<string>("");
  const [amount, setAmount] = useState<string>("0");
  const [activePopup, setActivePopup] = useState<string | null>(null);
  const [selectedSplitType, setSelectedSplitType] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [addToTransaction, setAddToTransaction] = useState(false);

  const { onKeyPress, evaluateExpression } = useCustomKeyboard("");
  const addTransactionToUI = useExpensifyStore((state) => state.addTransaction);
  const [subcategories, setSubcategories] = useState([]);
  const mainCategories = getMainCategories(categories);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [date, setDate] = useState(new Date());
  const [selectedBank, setSelectedBank] = useState({});
  const suggestions = useMemo(() => {
    const uniq = new Set();
    Object.values(transactions).forEach((t) => {
      const d = t.description?.trim();
      if (d) uniq.add(d);
    });
    return Array.from(uniq);
  }, [transactions]);
  const currentDate = new Date();
  const oldSplitSync: Appconstant = useExpensifyStore((state) =>
    state.getAppconstantByKey("lastSplitSync"),
  );
  const isPopupActive = (popup: string) => activePopup === popup;
  const handlePopupChange = (popup: string) => {
    const result = evaluateExpression();
    setAmount(result);
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
      amount: addSplitPayload.meOwe / 100,
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
    let parsedAmount = Number(amount) * 100;
    switch (type) {
      case "ME_PAY_EQUAL": {
        splitPayload = {
          mePay: parsedAmount,
          friendPay: 0,
          meOwe: parsedAmount / 2,
          frinedOwe: parsedAmount / 2,
        };
        break;
      }
      case "OTHER_PAY_EQUAL": {
        splitPayload = {
          mePay: 0,
          friendPay: parsedAmount,
          meOwe: parsedAmount / 2,
          frinedOwe: parsedAmount / 2,
        };
        break;
      }
      case "ME_OWE_ALL": {
        splitPayload = {
          mePay: parsedAmount,
          friendPay: 0,
          meOwe: 0,
          frinedOwe: parsedAmount,
        };
        break;
      }
      case "OTHER_OWE_ALL": {
        splitPayload = {
          mePay: 0,
          friendPay: parsedAmount,
          meOwe: parsedAmount,
          frinedOwe: 0,
        };
        break;
      }
    }
    setAddSplitPayload(splitPayload);
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
  const addSplit = async () => {
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
    setLoading(true);
    try {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr || !user) throw authErr || new Error("Not authenticated");
      const me = user.id;
      const amt = Number(amount);
      if (!amt || isNaN(amt)) throw new Error("Invalid amount");

      const { data: entryData, error: entryErr } = await supabase
        .from("ledger_entry")
        .insert({
          kind: "SPLIT",
          description,
          created_by: me,
          total_cents: amt,
        })
        .select("id")
        .single();
      if (entryErr) throw entryErr;
      const entryId = entryData.id as string;

      let lineItems: {
        entry_id: string;
        user_id: string;
        amount_cents: number;
        paid_cents: number;
        owed_cents: number;
      }[] = [
          {
            entry_id: entryId,
            user_id: me,
            amount_cents: addSplitPayload.mePay - addSplitPayload.meOwe,
            paid_cents: addSplitPayload.mePay,
            owed_cents: addSplitPayload.meOwe,
          },
          {
            entry_id: entryId,
            user_id: otherUserId,
            amount_cents: addSplitPayload.friendPay - addSplitPayload.frinedOwe,
            paid_cents: addSplitPayload.friendPay,
            owed_cents: addSplitPayload.frinedOwe,
          },
        ];
      const { error: liErr } = await supabase
        .from("line_item")
        .insert(lineItems);
      if (liErr) throw liErr;
      let newSince = await requestSync(oldSplitSync.value);
      let newSplitSync: Appconstant = {
        id: oldSplitSync.id,
        key: oldSplitSync.key,
        value: newSince,
      };
      await updateAppconstant(newSplitSync);
      if (addToTransaction) {
        let addedTransaction = await handleAddTransaction();
        await linkTransactionToLedgerEntry(addedTransaction.id, entryId);
      }
      navigation.pop();
      return entryId;
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };
  const half = parseInt(amount) / 2;
  const amtNumber = parseInt(amount);
  const options = [
    {
      key: "ME_PAY_EQUAL",
      title: "You paid, split equally",
      subtitle: `${userName} owes you ₹${half.toFixed(2)}`,
    },
    {
      key: "ME_OWE_ALL",
      title: "You are owed the full amount",
      subtitle: `${userName} owes you ₹${amtNumber.toFixed(2)}`,
    },
    {
      key: "OTHER_PAY_EQUAL",
      title: `${userName} paid, split equally`,
      subtitle: `You owe ${userName} ₹${half.toFixed(2)}`,
    },
    {
      key: "OTHER_OWE_ALL",
      title: `${userName} paid, you owe the full amount`,
      subtitle: `You owe ${userName} ₹${amtNumber.toFixed(2)}`,
    },
    {
      key: "CUSTOM",
      title: "Custom Split",
    },
  ];
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const customSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = ["45%"]; // main picker
  const customSnap = ["70%"]; // custom split editor
  const openSheet = () => {
    handlePopupChange("None");
    bottomSheetModalRef.current?.present();
  };
  const closeSheet = () => bottomSheetModalRef.current?.dismiss();
  return (
    <BottomSheetModalProvider>
      <Provider>
        <View style={styles.wrapper}>
          <View style={styles.headerContainer}>
            <HeaderNavigator
              onBackPress={() => navigation.goBack()}
              onTickPress={addSplit}
            />
            <HeaderText text="Add New Split" />
            <Text style={styles.subheading}>{userName}</Text>
          </View>
          <View style={styles.container}>
            <DescriptionAutocompleteInput
              label="Description"
              value={description}
              onChangeValue={setDescription}
              onFocus={() => {
                closeSheet();
                handlePopupChange("None");
              }}
              suggestions={suggestions}
              onPickSuggestion={(t) => {
                Keyboard.dismiss();
              }}
            />
            <AmountInput
              keyboardVisible={isPopupActive("customKeyboard")}
              setKeyboardVisible={() => {
                closeSheet();
                handlePopupChange("customKeyboard");
              }}
              value={amount}
              setValue={setAmount}
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
                      closeSheet();
                    }}
                  >
                    <Text style={styles.optionTitle}>{opt.title}</Text>
                    <Text style={styles.optionSub}>{opt.subtitle}</Text>
                  </TouchableOpacity>
                ),
              )}
              <TouchableOpacity
                onPress={() => {
                  closeSheet();
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
              total={parseInt(amount)}
              meName="You"
              friendName={userName}
              onDone={(pMe, pFr, oMe, oFr) => {
                setAddSplitPayload({
                  meOwe: oMe * 100,
                  frinedOwe: oFr * 100,
                  mePay: pMe * 100,
                  friendPay: pFr * 100,
                });
                setSelectedSplitType("CUSTOM"); // placeholder
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
                  }
                  const result = onKeyPress(key);
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

const styles = StyleSheet.create({
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
});

export default SplitInputScreen;

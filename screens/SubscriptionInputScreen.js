import React, { useContext, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  Keyboard,
  Touchable,
  Image,
} from "react-native";
import subscriptionFrequency from "../constants/subscriptionFrequency";
import { CheckBox } from "@rneui/themed";
import {
  TextInput,
  Button,
  Menu,
  Provider,
  DefaultTheme,
} from "react-native-paper";
import { COLORS, SIZES, FONTS, icons } from "../constants";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useNavigation, useRoute } from "@react-navigation/native";
import { DataContext } from "../contexts/DataContext";
import IconCategoryMapping from "../services/IconCategoryMapping";
import {
  addTransaction,
  editExistingTransaction,
} from "../services/TransactionService";
import { calculateNextDate } from "../services/Utils";
import { TouchableOpacity } from "react-native";
import { addSubscription } from "../services/SubscriptionService";
import {
  convertAndFilterUndeletedAndMainCategories,
  getCategoryObjectsWithParent,
} from "../services/CategoryService";

const SubscriptionInputScreen = () => {
  route = useRoute();
  let transaction = null;
  if (route.params) {
    transaction = route.params.transaction;
  }
  const {
    banks,
    transactions,
    updateTransactions,
    updateBanks,
    subscriptions,
    updateSubscriptions,
    categories,
  } = useContext(DataContext);
  const mainCategories = convertAndFilterUndeletedAndMainCategories(categories);
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
  const [selectedCategory, setSelectedCategory] = useState(
    transaction ? transaction.category : null,
  );
  const [selectedFrequency, setSelectedFrequency] = useState(null);
  const [showFrequencyMenu, setFrequencyMenu] = useState(false);
  const [showBankMenu, setBankMenu] = useState(false);
  const [showCategoryMenu, setCategoryMenu] = useState(false);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [bankAnchor, setBankAnchor] = useState({ x: 0, y: 0 });
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
  const [subcategoryMenu, setSubcategoryMenu] = useState(0);
  const [error, setError] = useState(null);
  const currentDate = new Date();
  const navigation = useNavigation();
  const [categoryId, setCategoryId] = useState(null);
  const makeSubscriptionObject = () => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    const formattedDate = `${year}-${month}-${day}`;
    const signedAmount = selectedCredit == 1 ? amount : -amount;
    const newTransaction = {
      amount: signedAmount,
      title: description,
      on_record: Number(checkOnRecord),
      bank_name: selectedBank,
      last_date: formattedDate,
      next_date: calculateNextDate(formattedDate, selectedFrequency),
      category: selectedSubcategory ? selectedSubcategory : selectedCategory,
      icon_name: categories[categoryId].icon_name,
      icon_type: categories[categoryId].icon_type,
      frequency: selectedFrequency,
      category_id: categoryId,
    };
    return newTransaction;
  };
  const handleAddSubscription = async () => {
    if (
      !amount.trim() ||
      !description.trim() ||
      selectedBank == null ||
      selectedCategory == null ||
      selectedFrequency == null
    ) {
      setError("Please fill all the required values.");
      return;
    }
    const newSubscription = makeSubscriptionObject();
    const updatedSubscriptions = await addSubscription(
      newSubscription,
      subscriptions,
    );
    updateSubscriptions(updatedSubscriptions);
    navigation.pop();
  };

  const handleCancelInput = () => {
    navigation.pop();
  };
  const handleSelectBank = (bank) => {
    setSelectedBank(bank);
    setBankMenu(false);
  };
  const handleSelectCategory = (selectedCategory, id) => {
    setCategoryId(id);
    setSelectedCategory(selectedCategory);
    const subcategories = getCategoryObjectsWithParent(
      categories,
      selectedCategory,
    );
    if (Object.keys(subcategories).length > 1) {
      setSubcategories(subcategories);
    } else setSubcategories(null);
    setSelectedSubcategory(null);
    setCategoryMenu(false);
  };
  const handleSelectSubcategory = (selectedSubcategory, id) => {
    setCategoryId(id);
    setSelectedSubcategory(selectedSubcategory);
    setSubcategoryMenu(false);
  };
  const handleSelectFrequency = (selectedFrequency) => {
    setSelectedFrequency(selectedFrequency);
    setFrequencyMenu(false);
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
  const handleSubcategoryMenuPopUp = () => {
    setSubcategoryMenu(true);
    Keyboard.dismiss;
  };
  const handleFrequencyMenuPopUp = () => {
    setFrequencyMenu(true);
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

            <TouchableOpacity onPress={handleAddSubscription}>
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
            {"Add New Subscription"}
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
          <TouchableOpacity onPress={() => handleFrequencyMenuPopUp()}>
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
                    {selectedFrequency ? selectedFrequency : "Select Frequency"}
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
          </TouchableOpacity>
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
          <TextInput
            outlineColor={COLORS.primary}
            activeOutlineColor={COLORS.primary}
            mode="outlined"
            label={selectedCredit == 0 ? "Last Debit" : "Last Credit"}
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

          <TouchableOpacity onPress={() => handleCategoryMenuPopUp()}>
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
              style={{ width: 200 }}
            >
              {mainCategories.map((category) => (
                <Menu.Item
                  key={category.id}
                  onPress={() =>
                    handleSelectCategory(category.name, category.id)
                  }
                  title={category.name}
                />
              ))}
            </Menu>
          </TouchableOpacity>
          {subcategories ? (
            <TouchableOpacity onPress={() => handleSubcategoryMenuPopUp()}>
              <Menu
                visible={subcategoryMenu}
                onDismiss={() => setSubcategoryMenu(false)}
                theme={menuTheme}
                anchor={
                  <Button
                    onPress={() => handleSubcategoryMenuPopUp()}
                    style={styles.menuButton}
                  >
                    <Text style={{ color: COLORS.black }}>
                      {selectedSubcategory
                        ? selectedSubcategory
                        : "Select SubCategory (optional)"}
                    </Text>
                  </Button>
                }
                style={{ width: 200 }}
              >
                {subcategories.map((category) => (
                  <Menu.Item
                    key={category.name}
                    onPress={() =>
                      handleSelectSubcategory(category.name, category.id)
                    }
                    title={category.name}
                  />
                ))}
              </Menu>
            </TouchableOpacity>
          ) : null}

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
            <Text style={{ color: COLORS.red, marginLeft: 10 }}>{error}</Text>
          ) : null}
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
});

export default SubscriptionInputScreen;

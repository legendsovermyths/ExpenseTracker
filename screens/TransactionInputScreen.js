import React, { useContext, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  Keyboard,
  TouchableWithoutFeedback,
  Image,
} from "react-native";
import { CheckBox } from "@rneui/themed";
import { evaluate } from 'mathjs';
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
import categories from "../constants/category";
import { DataContext } from "../contexts/DataContext";
import IconCategoryMapping from "../services/IconCategoryMapping";
import CustomKeyboard from "../components/CustomKeyboard";
import {
  addTransaction,
  editExistingTransaction,
} from "../services/TransactionService";
import { TouchableOpacity } from "react-native";
import { log } from "mathjs";
const getCategoryObjectsWithParent = (data, category) => {
  return Object.keys(data)
    .filter(key => data[key].parent_category === category)
    .map((key, index) => {
      const value = data[key];
      return {
        ...value
      };
    });
};
const TransactionInputScreen = () => {
  route = useRoute();
  let transaction = null;
  if (route.params) {
    transaction = route.params.transaction;
  }
  const { banks, transactions, updateTransactions, updateBanks, mainCategories, categories } =
    useContext(DataContext);
  const [amount, setAmount] = useState(
    transaction ? Math.abs(transaction.amount).toString() : ""
  );
  const [selectedCredit, setSelectedCredit] = useState(
    transaction ? Number(transaction.amount > 0) : 0
  );
  const [checkOnRecord, setCheckOnRecord] = useState(
    transaction ? transaction.on_record > 0 : true
  );
  const [description, setDescription] = useState(
    transaction ? transaction.title : ""
  );
  const [selectedBank, setSelectedBank] = useState(
    transaction ? transaction.bank_name : null
  );
  const [selectedCategory, setSelectedCategory] = useState(
    transaction ? transaction.parent_category : null
  );
  const [selectedSubcategory, setSelectedSubcategory] = useState(
    (transaction&&transaction.category!=transaction.parent_category)?transaction.category: null
  )
  const [subcategories, setSubcategories] = useState(transaction?getCategoryObjectsWithParent(categories,transaction.parent_category ):null);
  const [subcategoryMenu,setSubcategoryMenu]=useState(0);
  const [showBankMenu, setBankMenu] = useState(false);
  const [showCategoryMenu, setCategoryMenu] = useState(false);
  const [date, setDate] = useState(
    transaction ? new Date(transaction.date) : new Date()
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [bankAnchor, setBankAnchor] = useState({ x: 0, y: 0 });
  const [error, setError] = useState(null);
  const currentDate = new Date();
  const navigation = useNavigation();
  const [categoryId, setCategoryId]=useState(transaction?transaction.category_id:null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const handleCustomKeyPress = (key) => {
    if (key === 'C') {
      setAmount('');
    } else if (key === 'Done') {
      if(!amount.trim()){
        setKeyboardVisible(false);
        return;
      }
      try {
        const result = evaluate(amount);
        result<0?setAmount('Error'):setAmount(result.toString());        
        setKeyboardVisible(false);
      } catch (error) {
        console.log(error);
        setAmount('Error');
        setKeyboardVisible(false);
      }
    } else {
      setAmount((prevInput) => prevInput + key);
    }
  };
  const makeTransactionObject = () => {
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
      date: formattedDate,
      category: selectedSubcategory?selectedSubcategory:selectedCategory,
      parent_category:selectedCategory,
      icon_name: categories[categoryId].icon_name,
      icon_type:  categories[categoryId].icon_type,
      category_id:categoryId
    };
    return newTransaction;
  };
  const handleAddTransaction = async () => {
    if (
      !amount.trim() ||
      !description.trim() ||
      selectedBank == null ||
      selectedCategory == null ||
      amount === 'Error'
    ) {
      setError("Please fill all the required values.");
      return;
    }
    navigation.pop();
    const newTransaction = makeTransactionObject();
    const { updatedTransactions, updatedBanks } = await addTransaction(
      newTransaction,
      transactions,
      banks
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
      banks
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
  const handleSelectCategory = (selectedCategory, id) => {
    setCategoryId(id);
    setSelectedCategory(selectedCategory);
    const subcategories=getCategoryObjectsWithParent(categories,selectedCategory);
    if(Object.keys(subcategories).length>1){
      setSubcategories(subcategories);
    }
    else setSubcategories(null)
    setSelectedSubcategory(null);
    setCategoryMenu(false);
  };
  const handleSelectSubcategory=(selectedSubcategory, id)=>{
    setCategoryId(id);
    setSelectedSubcategory(selectedSubcategory);
    setSubcategoryMenu(false);
  }
  const handleDateChange = (event, selectedDate) => {
    const dateSelected = selectedDate || currentDate;
    setDate(dateSelected);
    setShowDatePicker(false);
  };
  const handleBankMenuPopUp = (event) => {
    setBankMenu(true);
    Keyboard.dismiss();
    handleKeyboardClosing();
    setShowDatePicker(false);
  };
  const handleCategoryMenuPopUp = () => {
    setCategoryMenu(true);
    Keyboard.dismiss();
    handleKeyboardClosing();
    setShowDatePicker(false);
  };
  const handleSubcategoryMenuPopUp = () =>{
    setSubcategoryMenu(true);
    Keyboard.dismiss
    handleKeyboardClosing();
    setShowDatePicker(false);
  }
  const handleDateInputPopUp = () => {
    setShowDatePicker(true);
    Keyboard.dismiss();
    handleKeyboardClosing();
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
  const handleAmountFcous = () =>{
    Keyboard.dismiss()
    setAmount(" ");
    setKeyboardVisible(true)
  }
  const handleKeyboardClosing = () =>{
    if(amount===" "){
      setAmount("");
      setKeyboardVisible(false);
      return;
    }
    if(!amount.trim()){
      setKeyboardVisible(false);
      return;
    }
    try {
      const result = evaluate(amount);
      result<0?setAmount('Error'):setAmount(result.toString());        
      setKeyboardVisible(false);
    } catch (error) {
      console.log(error);
      setAmount('Error');
      setKeyboardVisible(false);
    }
  }
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

            <TouchableOpacity onPress={transaction?handleEditTransaction:handleAddTransaction}>
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
            {transaction ? "Edit transaction" : "Add New Transaction"}
          </Text>
        </View>
        <View style={styles.container}>
          <TextInput
            mode="outlined"
            outlineColor={COLORS.primary}
            activeOutlineColor={COLORS.primary}
            label="Description"
            value={description}
            onFocus={()=>handleKeyboardClosing()}
            onChangeText={setDescription}
            style={[styles.input, { backgroundColor: COLORS.white }]}
            theme={{ roundness: 30 }}
          />

          <TextInput
            mode="outlined"
            outlineColor={COLORS.primary}
            outlineStyle={{borderWidth:keyboardVisible?2:1}}
            activeOutlineColor={COLORS.primary}
            label="Amount"
            value={amount}
            onChangeText={setAmount}
            disabled={false}
            onFocus={()=>handleAmountFcous()}
            style={[styles.input, { backgroundColor: COLORS.white }]}
            theme={{ roundness: 30 }}
          />
          <TouchableOpacity onPress={handleBankMenuPopUp}>
            
 
          <Menu
            visible={showBankMenu}
            onDismiss={() => setBankMenu(false)}
            theme={menuTheme}
            anchor={<Button
              onPress={handleBankMenuPopUp}
              style={styles.menuButton}
              textColor={COLORS.black}
            >
              {selectedBank ? selectedBank : "Select Bank"}
            </Button>}
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
          </TouchableOpacity>

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
              style={{ width: 200 }} // Set the background color of the menu
            >
              {mainCategories.map((category) => (
                <Menu.Item
                  key={category.id}
                  onPress={() => handleSelectCategory(category.name, category.id)}
                  title={category.name}
                />
              ))}
            </Menu>
          </TouchableOpacity>
          {subcategories?(<TouchableOpacity onPress={() => handleSubcategoryMenuPopUp()}>
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
                    {selectedSubcategory ? selectedSubcategory : "Select SubCategory (optional)"}
                  </Text>
                </Button>
              }
              style={{ width: 200 }} // Set the background color of the menu
            >
              {subcategories.map((category) => (
                <Menu.Item
                  key={category.id}
                  onPress={() => handleSelectSubcategory(category.name, category.id)}
                  title={category.name}
                />
              ))}
            </Menu>
          </TouchableOpacity>):null}
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
        {keyboardVisible?(<View style={styles.modalContent}>
                <CustomKeyboard onKeyPress={handleCustomKeyPress} />
                </View>):null}

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
    height:100,
    width:'100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    backgroundColor: COLORS.white,
  },
});

export default TransactionInputScreen;

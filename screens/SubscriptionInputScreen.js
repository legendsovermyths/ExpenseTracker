import React, { useState } from 'react';
import { View, StyleSheet, Text, Keyboard} from 'react-native';
import { TextInput, Button, Menu, Provider, DefaultTheme} from 'react-native-paper';
import { COLORS, SIZES,  FONTS} from '../constants'; // Assuming you have a COLORS and SIZES constant
import { Colors } from 'react-native/Libraries/NewAppScreen';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';

const SubscriptionInputScreen = () => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedBank, setSelectedBank] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showBankMenu, setBankMenu] = useState(false);
  const [showCategoryMenu, setCategoryMenu] = useState(false);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const banks = ['Bank A', 'Bank B', 'Bank C']; 
  const categories = ['Category A', 'Category B', 'Category C']; 
  const currentDate=new Date();
  const navigation = useNavigation();
  const handleAddTransaction = () => {
    console.log('Adding transaction:', { amount, description, selectedBank, selectedCategory, date });
      navigation.goBack();
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
    const currentDate = selectedDate||currentDate;
    setShowDatePicker(false);
    setDate(currentDate);
  };
  const handleBankMenuPopUp = () =>{
    setBankMenu(true)
    Keyboard.dismiss()
  }
  const handleCategoryMenuPopUp = ()=>{
    setCategoryMenu(true);
    Keyboard.dismiss()
  }
  const handleDateInputPopUp= () =>{
    setShowDatePicker(true);
    Keyboard.dismiss();
  }
  const menuTheme = {
    ...DefaultTheme,
    roundness: 20, // Set the roundness of the menu
    colors: {
      ...DefaultTheme.colors,
      elevation:{
        ...DefaultTheme.colors.elevation,
        level2:COLORS.white

      },
    },
  };
  
  return (
    <Provider>
      <View style={{ flex: 1, backgroundColor: COLORS.lightGray2 }}>
      <View
        style={{
          paddingHorizontal: SIZES.padding,
          paddingTop: (5 * SIZES.padding) / 2,
          backgroundColor: COLORS.white,
        }}
      >

        <Text style={{ marginLeft: SIZES.padding / 6, color: COLORS.primary, ...FONTS.h2 }}>Input transaction details</Text>
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
        <Menu
          visible={showBankMenu}
          onDismiss={() => setBankMenu(false)}
          theme={menuTheme}
          anchor={
            <Button onPress={handleBankMenuPopUp} style={styles.menuButton}>
              <Text style={{color:COLORS.black}}>{selectedBank ? selectedBank : 'Select Bank'}</Text>
            </Button>
          }
          style={{ width: 200}} // Set the background color of the menu
        >
          {banks.map((bank) => (
            <Menu.Item key={bank} onPress={() => handleSelectBank(bank)} title={bank} />
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
          style={{position:"absolute",backgroundColor:COLORS.white,bottom:90,left:30,zIndex:100,borderRadius:20}}
          maximumDate={currentDate}
        />)}

        <Menu
          visible={showCategoryMenu}
          onDismiss={() => setCategoryMenu(false)}
          theme={menuTheme}
          anchor={
            <Button onPress={() => handleCategoryMenuPopUp() } style={styles.menuButton}>
              <Text style={{color:COLORS.black}}>{selectedCategory ? selectedCategory : 'Select Category'}</Text>
            </Button>
          }
          style={{ width: 200}} // Set the background color of the menu
        >
          {categories.map((category) => (
            <Menu.Item key={category} onPress={() => handleSelectCategory(category)} title={category} />
          ))}
        </Menu>

        <Button mode="contained" onPress={handleAddTransaction} style={styles.addButton}>
          Add Transaction
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom:20
  },
});

export default SubscriptionInputScreen

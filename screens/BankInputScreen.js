import React, { useState } from 'react';
import { View, StyleSheet, Text, Keyboard} from 'react-native';
import { TextInput, Button, Menu, Provider, DefaultTheme} from 'react-native-paper';
import { COLORS, SIZES,  FONTS} from '../constants'; // Assuming you have a COLORS and SIZES constant
import { Colors } from 'react-native/Libraries/NewAppScreen';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';

const BankInputScreen = () => {
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
  const handleCancelInput = () =>{
    navigation.pop();
  }
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

        <Text style={{ marginLeft: SIZES.padding / 6, color: COLORS.primary, ...FONTS.h1 }}>Bank details</Text>
        </View>
      <View style={styles.container}>
      <TextInput
          mode="outlined"
          outlineColor={COLORS.primary}
          activeOutlineColor={COLORS.primary}
          label="Name"
          value={description}
          onChangeText={setDescription}
          style={[styles.input, { backgroundColor: COLORS.white }]}
          theme={{ roundness: 30 }} // Make the outlined text input round
        />
        <TextInput
          mode="outlined"
          outlineColor={COLORS.primary}
          activeOutlineColor={COLORS.primary}
          label="Balance"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          style={[styles.input, { backgroundColor: COLORS.white }]}
          theme={{ roundness: 30 }} // Make the outlined text input round
        />
       
        <Button mode="contained" onPress={handleAddTransaction} style={styles.addButton}>
          Add account
        </Button>
        <Button mode="contained" onPress={handleCancelInput} style={styles.cancelButton}>
          <Text style={{color:COLORS.red}}>Cancel</Text>
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
  cancelButton:{
    marginTop: 20,
    backgroundColor: 'transparent',
    borderRadius: 20,
    color:COLORS.red2
  }
});

export default BankInputScreen;

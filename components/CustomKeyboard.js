import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../constants';

const CustomKeyboard = ({ onKeyPress }) => {
  const keys = [
    '1', '2', '3', '+',
    '4', '5', '6', '-',
    '7', '8', '9', '*',
    '(', '0', ')', '/',
    'Done', 'C' ,  '.'
  ];

  return (
    <View style={styles.keyboardContainer}>
      {keys.map((key) => (
        <TouchableOpacity key={key} style={styles.key} onPress={() => onKeyPress(key)}>
          <Text style={styles.keyText}>{key}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    backgroundColor:COLORS.white ,
    padding: 10,
  },
  key: {
    width: '22%',
    padding: 15,
    margin: 3,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8
  },
  keyText: {
    fontSize: 18,
    color:COLORS.primary,
  },
});

export default CustomKeyboard;

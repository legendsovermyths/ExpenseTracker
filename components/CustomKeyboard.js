import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../constants';

const CustomKeyboard = ({ onKeyPress }) => {
  const keys = [
    '1', '2', '3', '+',
    '4', '5', '6', '-',
    '7', '8', '9', '*',
    '(', '0', ')', '/',
    'Done', '', 'C','.',
  ];

  return (
    <View style={styles.keyboardContainer}>
      {keys.map((key) => (
        <TouchableOpacity pressDuration={0} key={key} style={styles.key} onPress={() => onKeyPress(key)}>
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
    backgroundColor: COLORS.lightGray,
    padding: 10,
    paddingBottom:35,
    paddingHorizontal:15,
    marginBottom:10
  },
  key: {
    width: '22%',
    padding: 15,
    margin: 3,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    elevation: 5,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3, 
  },
  keyText: {
    fontSize: 18,
    color: COLORS.primary,
  },
});

export default CustomKeyboard;

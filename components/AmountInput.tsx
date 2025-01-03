import React, { useState } from "react";
import { Keyboard, StyleSheet } from "react-native";
import { COLORS } from "../constants";
import { TextInput } from "react-native-paper";
import AmountInputStyles from "../styles/AmountInput.styles";
interface AmountInputProps {
  value: string;
  setValue: (value: string) => void;
  keyboardVisible: boolean;
  setKeyboardVisible: (visible: boolean) => void;
}

const AmountInput: React.FC<AmountInputProps> = ({
  value,
  setValue,
  keyboardVisible,
  setKeyboardVisible,
}) => {
  const handleAmountFocus = () => {
    Keyboard.dismiss();
    setKeyboardVisible(true);
  };

  return (
    <TextInput
      mode="outlined"
      outlineColor={COLORS.primary}
      outlineStyle={{ borderWidth: keyboardVisible ? 2 : 1 }}
      activeOutlineColor={COLORS.primary}
      label="Amount"
      value={value}
      onFocus={handleAmountFocus}
      style={AmountInputStyles.input}
      theme={{ roundness: 30 }}
    />
  );
};

export default AmountInput;

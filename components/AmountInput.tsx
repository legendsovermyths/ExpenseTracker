import React, { useState } from "react";
import { Keyboard, StyleSheet } from "react-native";
import { TextInput } from "react-native-paper";
import AmountInputStyles from "../styles/AmountInput.styles";
import { useTheme } from "../contexts/ThemeContext";
interface AmountInputProps {
  value: string;
  keyboardVisible: boolean;
  setKeyboardVisible: (visible: boolean) => void;
}

const AmountInput: React.FC<AmountInputProps> = ({
  value,
  keyboardVisible,
  setKeyboardVisible,
}) => {
  const { COLORS } = useTheme();
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

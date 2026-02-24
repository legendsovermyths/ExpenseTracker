import React, { useMemo } from "react";
import { Keyboard, StyleSheet } from "react-native";
import { TextInput } from "react-native-paper";
import { createStyles } from "../styles/AmountInput.styles";
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
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
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
      style={styles.input}
      textColor={COLORS.black}
      theme={{
        roundness: 30,
        colors: {
          onSurfaceVariant: COLORS.darkgray,
        }
      }}
    />
  );
};

export default AmountInput;

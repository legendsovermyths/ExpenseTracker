import React from "react";
import { TextInput } from "react-native-paper";
import { COLORS } from "../constants";
import DescriptionInputStyles from "../styles/DescriptionInput.styles";
const DescriptionInput = ({
  value,
  onChangeValue,
  label,
  onFocus = () => {},
}) => {
  const handleFocus = () => {
    onFocus();
  };

  return (
    <TextInput
      mode="outlined"
      outlineColor={COLORS.primary}
      activeOutlineColor={COLORS.primary}
      label={label}
      value={value}
      onFocus={handleFocus}
      onChangeText={onChangeValue}
      style={DescriptionInputStyles.input}
      theme={{ roundness: 30}}
    />
  );
};

export default DescriptionInput;

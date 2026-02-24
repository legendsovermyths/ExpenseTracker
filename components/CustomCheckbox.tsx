import React from 'react';
import { CheckBox } from "@rneui/themed";
import { useTheme } from '../contexts/ThemeContext';

interface CustomCheckboxProps {
  selected: boolean;
  onPress: () => void;
  title: string;
  checkedIcon?: string;
  uncheckedIcon?: string;
  checkedColor?: string;
}

const CustomCheckbox: React.FC<CustomCheckboxProps> = ({
  selected,
  onPress,
  title,
  checkedIcon = "dot-circle-o",
  uncheckedIcon = "circle-o",
  checkedColor,
}) => {
  const { COLORS } = useTheme();
  return (
    <CheckBox
      checked={selected}
      onPress={onPress}
      checkedIcon={checkedIcon}
      uncheckedIcon={uncheckedIcon}
      title={title}
      checkedColor={checkedColor ?? COLORS.primary}
      containerStyle={{ backgroundColor: 'transparent' }}
      textStyle={{ color: COLORS.primary }}
    />
  );
};

export default CustomCheckbox;

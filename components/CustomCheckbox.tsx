import React from 'react';
import { CheckBox } from "@rneui/themed";
import { COLORS } from '../constants'; 

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
  checkedColor = COLORS.primary,
}) => {
  return (
    <CheckBox
      checked={selected}
      onPress={onPress}
      checkedIcon={checkedIcon}
      uncheckedIcon={uncheckedIcon}
      title={title}
      checkedColor={checkedColor}
    />
  );
};

export default CustomCheckbox;

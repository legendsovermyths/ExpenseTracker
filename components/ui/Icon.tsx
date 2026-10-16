import React from "react";
import { StyleProp, TextStyle } from "react-native";
import { Icon as RNEIcon } from "react-native-elements";
import { ICON } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";

export interface IconProps {
  name: string;
  size?: keyof typeof ICON | number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

/** Material Community icon at a token size, ink by default. */
const Icon: React.FC<IconProps> = ({ name, size = "lg", color, style }) => {
  const { COLORS } = useTheme();
  const px = typeof size === "number" ? size : ICON[size];
  return (
    <RNEIcon
      name={name}
      type="material-community"
      size={px}
      color={color ?? COLORS.ink}
      style={style as any}
    />
  );
};

export default Icon;

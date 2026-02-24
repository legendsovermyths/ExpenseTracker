import React from "react";
import { Text } from "react-native";
import { createStyles } from "../styles/HeaderText.styles";
import { useTheme } from "../contexts/ThemeContext";

interface HeaderTextProps {
  text: string;
}

const HeaderText: React.FC<HeaderTextProps> = ({ text }) => {
  const { COLORS } = useTheme();
  const HeaderTextStyles = createStyles(COLORS);
  return <Text style={HeaderTextStyles.text}>{text}</Text>;
};

export default HeaderText;

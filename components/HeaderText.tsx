import React from "react";
import { Text } from "react-native";
import HeaderTextStyles from "../styles/HeaderText.styles";

interface HeaderTextProps {
  text: string; 
}

const HeaderText: React.FC<HeaderTextProps> = ({ text }) => {
  return <Text style={HeaderTextStyles.text}>{text}</Text>;
};

export default HeaderText;

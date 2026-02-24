import React from "react";
import { View, TouchableOpacity, Image, StyleSheet } from "react-native";
import { createStyles } from "../styles/HeaderNavigator.styles";
import { icons } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
interface HeaderNavigatorProps {
  onBackPress: () => void;
  onTickPress: () => void;
}

const HeaderNavigator: React.FC<HeaderNavigatorProps> = ({
  onBackPress,
  onTickPress,
}) => {
  const { COLORS } = useTheme();
  const HeaderNavigatorStyles = createStyles(COLORS);
  return (
    <View style={HeaderNavigatorStyles.container}>
      <TouchableOpacity onPress={onBackPress}>
        <Image source={icons.back_arrow} style={HeaderNavigatorStyles.backIcon} />
      </TouchableOpacity>

      <TouchableOpacity onPress={onTickPress}>
        <Image source={icons.tick} style={HeaderNavigatorStyles.tickIcon} />
      </TouchableOpacity>
    </View>
  );
};

export default HeaderNavigator;

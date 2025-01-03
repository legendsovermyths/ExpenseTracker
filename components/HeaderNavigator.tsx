import React from "react";
import { View, TouchableOpacity, Image, StyleSheet } from "react-native";
import HeaderNavigatorStyles from "../styles/HeaderNavigator.styles";
import { icons } from "../constants";
interface HeaderNavigatorProps {
  onBackPress: () => void; 
  onTickPress: () => void;
  icons: {
    back_arrow: any; 
    tick: any;
  };
}

const HeaderNavigator: React.FC<HeaderNavigatorProps> = ({
  onBackPress,
  onTickPress,
}) => {
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

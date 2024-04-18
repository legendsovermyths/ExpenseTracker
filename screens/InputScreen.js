import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { COLORS, FONTS, SIZES } from "../constants";


const InputScreen = () => {
 
  const handleUnsubscribe = (id) => {
    console.log("Unsubscribe from subscription with id:", id);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.lightGray2 }}>
      <Text>
        Input Screen
      </Text>
    </View>
  );
};


export default InputScreen;

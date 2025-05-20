import React from "react";
import { View, Image, StyleSheet } from "react-native";
import { appicon } from "../constants/icons";

const LoadingScreen: React.FC = () => (
  <View style={styles.container}>
    <Image source={appicon} style={styles.icon} />
  </View>
);

export default LoadingScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
  },
  icon: {
    width: 80, 
    height: 80,
    resizeMode: "contain",
  },
});

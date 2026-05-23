import React from "react";
import { View, Image, StyleSheet } from "react-native";
import { appicon } from "../constants/icons";
import { useTheme } from "../contexts/ThemeContext";

const LoadingScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const styles = React.useMemo(() => createStyles(COLORS), [COLORS]);

  return (
    <View style={styles.container}>
      <Image source={appicon} style={styles.icon} />
    </View>
  );
};

export default LoadingScreen;

const createStyles = (COLORS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    justifyContent: "center",
    alignItems: "center",
  },
  icon: {
    width: 80,
    height: 80,
    resizeMode: "contain",
  },
});

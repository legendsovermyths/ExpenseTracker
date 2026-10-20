import React from "react";
import { View, Image, StyleSheet } from "react-native";
import { applogo, applogoDark } from "../constants/icons";
import { useTheme } from "../contexts/ThemeContext";

const LoadingScreen: React.FC = () => {
  const { COLORS, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(COLORS), [COLORS]);

  return (
    <View style={styles.container}>
      <Image source={isDark ? applogoDark : applogo} style={styles.icon} />
    </View>
  );
};

export default LoadingScreen;

const createStyles = (COLORS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paper,
    justifyContent: "center",
    alignItems: "center",
  },
  // Matches the native splash mark so the hand-off doesn't jump.
  icon: {
    width: 92,
    height: 118,
    resizeMode: "contain",
  },
});

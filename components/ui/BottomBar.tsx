import React from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SPACE } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";

export interface BottomBarProps {
  children: React.ReactNode;
  /** Ride above the system keyboard. Off when a custom keypad sits below. */
  followKeyboard?: boolean;
  /** Draw a hairline on top (use when content scrolls underneath). */
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Pins the primary action to the bottom, above the home indicator / keyboard. */
const BottomBar: React.FC<BottomBarProps> = ({ children, followKeyboard = true, divider, style }) => {
  const { COLORS } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();

  const lift = useAnimatedStyle(() => {
    const kb = followKeyboard ? keyboard.height.value : 0;
    return { transform: [{ translateY: -Math.max(0, kb - insets.bottom) }] };
  }, [followKeyboard, insets.bottom]);

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          paddingBottom: Math.max(insets.bottom, SPACE.lg),
          backgroundColor: COLORS.paper,
          borderTopColor: divider ? COLORS.hairline : "transparent",
        },
        lift,
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: SPACE.gutter,
    paddingTop: SPACE.md,
    gap: SPACE.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

export default BottomBar;

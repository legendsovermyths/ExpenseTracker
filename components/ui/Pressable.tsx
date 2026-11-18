import React from "react";
import {
  Pressable as RNPressable,
  PressableProps as RNPressableProps,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { MOTION } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";
import { haptic, HapticKind } from "./haptics";
import { EASE, timing } from "./motion";

const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

export type PressFeedback = "scale" | "highlight" | "none";

export interface PressableProps extends Omit<RNPressableProps, "style" | "children"> {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** Fire a haptic on press. */
  haptic?: HapticKind;
  /**
   * `scale` for buttons, cards and tiles; `highlight` (a faint ink wash) for
   * full-width list rows; `none` for controls that show their own state.
   */
  feedback?: PressFeedback;
}

/**
 * The single tappable primitive. Press feedback runs on the UI thread, so it
 * stays smooth even while JS is busy.
 */
const Pressable: React.FC<PressableProps> = ({
  style,
  haptic: hapticKind,
  feedback = "scale",
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  hitSlop = 6,
  children,
  ...rest
}) => {
  const { COLORS } = useTheme();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: disabled ? 0.4 : 1,
    transform: [
      { scale: feedback === "scale" ? 1 - pressed.value * (1 - MOTION.pressScale) : 1 },
    ],
  }));
  const wash = useAnimatedStyle(() => ({ opacity: pressed.value * 0.06 }));
  const radius = feedback === "highlight" ? StyleSheet.flatten(style)?.borderRadius : undefined;

  return (
    <AnimatedPressable
      {...rest}
      accessibilityRole={rest.accessibilityRole ?? "button"}
      accessibilityState={{ disabled: !!disabled, ...rest.accessibilityState }}
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={(e) => {
        if (feedback !== "none") pressed.value = withTiming(1, timing(MOTION.press));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (feedback !== "none") pressed.value = withTiming(0, timing(MOTION.quick, EASE.settle));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (hapticKind) haptic(hapticKind);
        onPress?.(e);
      }}
      style={[style, animatedStyle]}
    >
      {feedback === "highlight" && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: COLORS.ink, borderRadius: radius },
            wash,
          ]}
        />
      )}
      {children}
    </AnimatedPressable>
  );
};

export default Pressable;

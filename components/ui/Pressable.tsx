import React from "react";
import { Pressable as RNPressable, PressableProps as RNPressableProps, StyleProp, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { MOTION } from "../../constants";
import { haptic, HapticKind } from "./haptics";

const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

export interface PressableProps extends Omit<RNPressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
  /** Fire a haptic on press. */
  haptic?: HapticKind;
  /** Scale on press-in; set false for full-width rows where scaling looks odd. */
  scale?: boolean;
}

/**
 * The single tappable primitive. Press feedback (scale + dim) runs on the
 * UI thread, so it stays smooth even while JS is busy.
 */
const Pressable: React.FC<PressableProps> = ({
  style,
  haptic: hapticKind,
  scale = true,
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  hitSlop = 6,
  children,
  ...rest
}) => {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: disabled ? 0.4 : 1 - pressed.value * 0.25,
    transform: [{ scale: scale ? 1 - pressed.value * (1 - MOTION.pressScale) : 1 }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      accessibilityRole={rest.accessibilityRole ?? "button"}
      accessibilityState={{ disabled: !!disabled, ...rest.accessibilityState }}
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={(e) => {
        pressed.value = withTiming(1, { duration: MOTION.fast / 2 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = withSpring(0, MOTION.spring);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (hapticKind) haptic(hapticKind);
        onPress?.(e);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
};

export default Pressable;

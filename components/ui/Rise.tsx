import React, { useEffect } from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

export interface RiseProps {
  /** Position in the stagger; each step adds 50ms of delay. */
  index?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * Fades and lifts its content in once on mount. Plain opacity/translate on an
 * already laid-out view, unlike layout `entering` animations, which can flash
 * content at the wrong size for a frame on first mount.
 */
const Rise: React.FC<RiseProps> = ({ index = 0, style, children }) => {
  const reduced = useReducedMotion();
  const t = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    t.value = withDelay(
      60 + index * 50,
      withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }),
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const anim = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ translateY: (1 - t.value) * 12 }],
  }));

  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
};

export default Rise;

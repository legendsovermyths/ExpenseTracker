import React, { useEffect } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { MOTION, RADIUS } from "../../../constants";
import { useTheme } from "../../../contexts/ThemeContext";
import {
  Change,
  FeedbackKind,
  consumeChange,
  subscribeChange,
} from "../../../services/Feedback";
import { EASE, timing } from "../motion";

/**
 * "Ink drying": when the Feedback store marks an item, its row shows a faint
 * accent wash that dries away. New rows also settle in with a 4px rise.
 */
export const useRowFeedback = (
  kind: FeedbackKind,
  id: string | number,
  delay = 0,
) => {
  const wet = useSharedValue(0);
  const arrive = useSharedValue(1);

  useEffect(() => {
    const play = (change: Change) => {
      if (change === "added") {
        arrive.value = 0;
        arrive.value = withDelay(delay, withTiming(1, timing(MOTION.base)));
      }
      wet.value = withDelay(
        delay,
        withSequence(
          withTiming(1, timing(MOTION.quick)),
          withTiming(0, timing(MOTION.dry, EASE.settle)),
        ),
      );
    };
    const check = () => {
      const c = consumeChange(kind, id);
      if (c) play(c);
    };
    check();
    return subscribeChange(kind, id, check);
  }, [kind, id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { wet, arrive };
};

export interface FeedbackRowProps {
  kind: FeedbackKind;
  id: string | number;
  /** Stagger when several rows bloom at once (ms). */
  delay?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/** Wrap any list row. When its item was just added/edited the row dries in. */
export const FeedbackRow: React.FC<FeedbackRowProps> = ({
  kind,
  id,
  delay,
  style,
  children,
}) => {
  const { COLORS } = useTheme();
  const { wet, arrive } = useRowFeedback(kind, id, delay);
  const wash = useAnimatedStyle(() => ({ opacity: wet.value }));
  const enter = useAnimatedStyle((): ViewStyle => ({
    opacity: arrive.value,
    transform: [{ translateY: (1 - arrive.value) * 4 }],
  }));
  return (
    <Animated.View style={[style, enter]}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.wash,
          { backgroundColor: COLORS.accentSoft },
          wash,
        ]}
      />
      {children}
    </Animated.View>
  );
};

/** Kept for call sites; the glyph no longer pops. */
export const FeedbackGlyph: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <View>{children}</View>;

const SPACE_BLEED = 12;

const styles = StyleSheet.create({
  // Bleeds slightly past the row so the wash reads as ink, not a box.
  wash: { left: -SPACE_BLEED, right: -SPACE_BLEED, borderRadius: RADIUS.md },
});

import React, { createContext, useContext, useEffect } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  Easing,
  SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../../../contexts/ThemeContext";
import {
  Change,
  FeedbackKind,
  consumeChange,
  subscribeChange,
} from "../../../services/Feedback";

// Ink bleeding into paper: fast in, long soft tail out.
const BLEED = Easing.bezier(0.2, 0, 0, 1);

const GlyphPop = createContext<SharedValue<number> | null>(null);

/** Plays the bloom/grow-in for one item when the Feedback store marks it. */
export const useRowFeedback = (
  kind: FeedbackKind,
  id: string | number,
  delay = 0,
) => {
  const reduced = useReducedMotion();
  const bloom = useSharedValue(0);
  const pop = useSharedValue(1);
  const arrive = useSharedValue(1);

  useEffect(() => {
    const play = (change: Change) => {
      if (change === "added") {
        arrive.value = 0;
        arrive.value = withDelay(
          delay,
          withTiming(1, {
            duration: reduced ? 150 : 260,
            easing: Easing.out(Easing.cubic),
          }),
        );
      }
      if (reduced) {
        bloom.value = withDelay(
          delay,
          withSequence(
            withTiming(0.7, { duration: 80 }),
            withTiming(0, { duration: 300 }),
          ),
        );
        return;
      }
      bloom.value = withDelay(
        delay,
        withSequence(
          withTiming(1, { duration: 120 }),
          withTiming(0, { duration: 900, easing: BLEED }),
        ),
      );
      pop.value = withDelay(
        delay + 60,
        withSequence(
          withSpring(1.12, { damping: 9, stiffness: 320, mass: 0.6 }),
          withSpring(1, { damping: 14, stiffness: 260 }),
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

  return { bloom, pop, arrive };
};

export interface FeedbackRowProps {
  kind: FeedbackKind;
  id: string | number;
  /** Stagger when several rows bloom at once (ms). */
  delay?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * Wrap any list row. When its item was just added/edited it grows in,
 * blooms with the accent, and pops its `FeedbackGlyph`. Idle cost: nothing.
 */
export const FeedbackRow: React.FC<FeedbackRowProps> = ({
  kind,
  id,
  delay,
  style,
  children,
}) => {
  const { COLORS } = useTheme();
  const { bloom, pop, arrive } = useRowFeedback(kind, id, delay);
  const wash = useAnimatedStyle(() => ({ opacity: bloom.value }));
  const enter = useAnimatedStyle((): ViewStyle => ({
    opacity: arrive.value,
    transform: [
      { translateY: (1 - arrive.value) * -6 },
      { scale: 0.985 + arrive.value * 0.015 },
    ],
  }));
  return (
    <GlyphPop.Provider value={pop}>
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
    </GlyphPop.Provider>
  );
};

/** Put around a row's leading icon so it springs with the bloom. */
export const FeedbackGlyph: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const pop = useContext(GlyphPop);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: pop ? pop.value : 1 }],
  }));
  if (!pop) return <View>{children}</View>;
  return <Animated.View style={style}>{children}</Animated.View>;
};

const styles = StyleSheet.create({
  // Bleeds slightly past the row so the wash reads as ink, not a box.
  wash: { left: -12, right: -12, borderRadius: 12 },
});

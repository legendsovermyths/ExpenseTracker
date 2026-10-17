import React, { useEffect } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { MOTION } from "../../../constants";
import { useTheme } from "../../../contexts/ThemeContext";
import Pressable from "../Pressable";

const APath = Animated.createAnimatedComponent(Path);

export type DotState = "pending" | "added" | "skipped";

export interface ProgressDotsProps {
  states: DotState[];
  index: number;
  /** All items handled — the row flashes accent once. */
  done?: boolean;
  onPress?: (index: number) => void;
  style?: StyleProp<ViewStyle>;
}

const DOT = 8;
const ADDED = 14;
const GAP = 8;
const SLOT = ADDED + GAP;
const CHECK_LEN = 12;

/**
 * Bulk-carousel progress: pending dots, saved items fill like a drop of ink
 * and stroke a ✓, skipped ones dim, and the current position is a capsule
 * that slides between slots.
 */
const ProgressDots: React.FC<ProgressDotsProps> = ({
  states,
  index,
  done,
  onPress,
  style,
}) => {
  const { COLORS } = useTheme();
  const x = useSharedValue(index * SLOT);
  const flash = useSharedValue(0);

  useEffect(() => {
    x.value = withSpring(index * SLOT, MOTION.spring);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (done)
      flash.value = withSequence(
        withTiming(1, { duration: 120 }),
        withTiming(0, { duration: 420 }),
      );
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  const capsule = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));
  const row = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + flash.value * 0.06 }],
  }));

  return (
    <Animated.View
      style={[styles.row, { width: states.length * SLOT - GAP }, row, style]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.capsule, { borderColor: COLORS.accent }, capsule]}
      />
      {states.map((s, i) => (
        <Pressable
          key={i}
          scale={false}
          disabled={!onPress}
          onPress={() => onPress?.(i)}
          hitSlop={4}
          accessibilityLabel={`Item ${i + 1} of ${states.length}, ${s}`}
          style={styles.slot}
        >
          <Dot state={s} flash={!!done} />
        </Pressable>
      ))}
    </Animated.View>
  );
};

const Dot: React.FC<{ state: DotState; flash: boolean }> = ({
  state,
  flash,
}) => {
  const { COLORS } = useTheme();
  const reduced = useReducedMotion();
  const fill = useSharedValue(state === "added" ? 1 : 0);
  const stroke = useSharedValue(state === "added" ? 1 : 0);

  useEffect(() => {
    if (state === "added") {
      fill.value = reduced
        ? withTiming(1, { duration: 120 })
        : withSpring(1, { damping: 11, stiffness: 260, mass: 0.6 });
      stroke.value = withDelay(
        reduced ? 0 : 90,
        withTiming(1, {
          duration: reduced ? 0 : 200,
          easing: Easing.out(Easing.cubic),
        }),
      );
    } else {
      fill.value = withTiming(0, { duration: 120 });
      stroke.value = 0;
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const base = useAnimatedStyle(() => ({ opacity: 1 - fill.value }));
  const drop = useAnimatedStyle(() => ({
    opacity: Math.min(1, fill.value * 1.5),
    transform: [{ scale: fill.value }],
  }));
  const check = useAnimatedProps(() => ({
    strokeDashoffset: CHECK_LEN * (1 - stroke.value),
  }));

  return (
    <View style={styles.dotWrap}>
      <Animated.View
        style={[
          styles.dot,
          {
            backgroundColor: flash ? COLORS.accent : COLORS.inkSubtle,
            opacity: state === "skipped" ? 0.3 : 0.55,
          },
          base,
        ]}
      />
      <Animated.View
        style={[styles.added, { backgroundColor: COLORS.accent }, drop]}
      >
        <Svg width={10} height={10} viewBox="0 0 10 10">
          <APath
            d="M2 5.2 L4.2 7.3 L8 3"
            stroke={COLORS.paper}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={CHECK_LEN}
            animatedProps={check}
          />
        </Svg>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: GAP,
    height: ADDED + 8,
  },
  slot: {
    width: ADDED,
    height: ADDED,
    alignItems: "center",
    justifyContent: "center",
  },
  dotWrap: {
    width: ADDED,
    height: ADDED,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, position: "absolute" },
  added: {
    width: ADDED,
    height: ADDED,
    borderRadius: ADDED / 2,
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  capsule: {
    position: "absolute",
    left: -3,
    width: ADDED + 6,
    height: ADDED + 6,
    borderRadius: (ADDED + 6) / 2,
    borderWidth: 1.5,
  },
});

export default ProgressDots;

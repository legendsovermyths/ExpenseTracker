import React, { useEffect, useRef } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { MOTION } from "../../../constants";
import { useTheme } from "../../../contexts/ThemeContext";
import Pressable from "../Pressable";
import { timing } from "../motion";
import InkCheck from "./InkCheck";

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

/**
 * Bulk-carousel progress: pending dots, saved items get an inked ✓, skipped
 * ones dim, and the current position is a ring that glides between slots.
 * When everything is handled the remaining dots take the accent.
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

  useEffect(() => {
    x.value = withTiming(index * SLOT, timing(MOTION.base));
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  const capsule = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  return (
    <View style={[styles.row, { width: states.length * SLOT - GAP }, style]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.capsule, { borderColor: COLORS.accent }, capsule]}
      />
      {states.map((s, i) => (
        <Pressable
          key={i}
          feedback="none"
          disabled={!onPress}
          onPress={() => onPress?.(i)}
          hitSlop={4}
          accessibilityLabel={`Item ${i + 1} of ${states.length}, ${s}`}
          style={styles.slot}
        >
          <Dot state={s} done={!!done} />
        </Pressable>
      ))}
    </View>
  );
};

const Dot: React.FC<{ state: DotState; done: boolean }> = ({ state, done }) => {
  const { COLORS } = useTheme();
  // Restored "added" dots show their check without replaying the stroke.
  const initial = useRef(state === "added");
  const base = useAnimatedStyle(() => ({
    opacity: withTiming(
      state === "added" ? 0 : state === "skipped" ? 0.3 : 0.55,
      timing(MOTION.quick),
    ),
  }));

  return (
    <View style={styles.dotWrap}>
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: done ? COLORS.accent : COLORS.inkSubtle },
          base,
        ]}
      />
      <InkCheck
        drawn={state === "added"}
        instant={initial.current}
        size={ADDED}
        color={COLORS.paper}
        background={COLORS.accent}
        style={styles.added}
      />
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
  added: { position: "absolute" },
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

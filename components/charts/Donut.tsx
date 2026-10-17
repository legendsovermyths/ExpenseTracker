import React, { useEffect } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, {
  Easing,
  SharedValue,
  runOnJS,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { MOTION } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";
import { haptic } from "../ui/haptics";
import { arcPath } from "./scale";

const APath = Animated.createAnimatedComponent(Path);

export interface DonutSegment {
  value: number;
  color: string;
  label?: string;
}

export interface DonutProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  /** Controlled selection (index or null). */
  selected?: number | null;
  onSelect?: (index: number | null) => void;
  /** Centre content; receives the selected index. */
  center?: (selected: number | null) => React.ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const GAP = 0.035; // radians between segments
const POP = 5;

/** Ring chart that sweeps in; tap a segment to pop it out and select it. */
const Donut: React.FC<DonutProps> = ({
  segments,
  size = 184,
  thickness = 20,
  selected = null,
  onSelect,
  center,
  accessibilityLabel,
  style,
}) => {
  const { COLORS } = useTheme();
  const reduced = useReducedMotion();
  const sweep = useSharedValue(reduced ? 1 : 0);
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const visible = segments.filter((s) => s.value > 0).length;
  const gap = visible > 1 ? GAP : 0;

  // Cumulative [start, end] fractions for each segment.
  const bounds: [number, number][] = [];
  let acc = 0;
  segments.forEach((s) => {
    const f = total > 0 ? Math.max(0, s.value) / total : 0;
    bounds.push([acc, acc + f]);
    acc += f;
  });

  useEffect(() => {
    sweep.value = 0;
    sweep.value = withTiming(1, { duration: reduced ? 0 : 750, easing: Easing.out(Easing.cubic) });
  }, [segments.length, total]); // eslint-disable-line react-hooks/exhaustive-deps

  const r = size / 2 - POP;
  const c = size / 2;

  const select = (i: number | null) => {
    haptic("selection");
    onSelect?.(i === selected ? null : i);
  };

  const tap = Gesture.Tap().onEnd((e) => {
    const dx = e.x - c;
    const dy = e.y - c;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < r - thickness - 6 || dist > r + POP + 6) {
      runOnJS(select)(null);
      return;
    }
    let a = Math.atan2(dx, -dy);
    if (a < 0) a += Math.PI * 2;
    const f = a / (Math.PI * 2);
    const i = bounds.findIndex(([s, e2]) => f >= s && f < e2);
    runOnJS(select)(i >= 0 ? i : null);
  });

  return (
    <View
      style={[{ width: size, height: size, alignSelf: "center" }, style]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <GestureDetector gesture={tap}>
        <View>
          <Svg width={size} height={size}>
            {total === 0 ? (
              <Path d={arcPath(c, c, r, thickness, 0, Math.PI * 2)} fill={COLORS.surface1} />
            ) : (
              segments.map((s, i) =>
                s.value > 0 ? (
                  <Segment
                    key={i}
                    sweep={sweep}
                    start={bounds[i][0]}
                    end={bounds[i][1]}
                    gap={gap}
                    c={c}
                    r={r}
                    thickness={thickness}
                    color={s.color}
                    active={selected === i}
                    dim={selected !== null && selected !== i}
                  />
                ) : null,
              )
            )}
          </Svg>
        </View>
      </GestureDetector>
      {center && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center, { padding: thickness + POP + 6 }]}>
          {center(selected)}
        </View>
      )}
    </View>
  );
};

const Segment: React.FC<{
  sweep: SharedValue<number>;
  start: number;
  end: number;
  gap: number;
  c: number;
  r: number;
  thickness: number;
  color: string;
  active: boolean;
  dim: boolean;
}> = ({ sweep, start, end, gap, c, r, thickness, color, active, dim }) => {
  const pop = useSharedValue(0);
  const alpha = useSharedValue(1);
  useEffect(() => {
    pop.value = withSpring(active ? 1 : 0, MOTION.spring);
    alpha.value = withTiming(dim ? 0.3 : 1, { duration: 160 });
  }, [active, dim]); // eslint-disable-line react-hooks/exhaustive-deps

  const props = useAnimatedProps(() => {
    const TWO = Math.PI * 2;
    const a0 = start * TWO * sweep.value + gap / 2;
    const a1 = end * TWO * sweep.value - gap / 2;
    const rr = r + POP * pop.value;
    return { d: a1 > a0 ? arcPath(c, c, rr, thickness + POP * pop.value, a0, a1) : "", opacity: alpha.value };
  });
  return <APath animatedProps={props} fill={color} />;
};

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});

export default Donut;

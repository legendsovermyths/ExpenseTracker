import React, { useEffect } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "../../contexts/ThemeContext";

const ACircle = Animated.createAnimatedComponent(Circle);

export interface ProgressRingProps {
  /** 0–1 (values above 1 show a full ring). */
  progress: number;
  color?: string;
  size?: number;
  thickness?: number;
  children?: React.ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Goal ring: soft track, rounded progress arc that sweeps to its value. */
const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  color,
  size = 184,
  thickness = 14,
  children,
  accessibilityLabel,
  style,
}) => {
  const { COLORS } = useTheme();
  const reduced = useReducedMotion();
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withTiming(Math.max(0, Math.min(1, progress)), {
      duration: reduced ? 0 : 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]); // eslint-disable-line react-hooks/exhaustive-deps

  const props = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - p.value) }));

  return (
    <View
      style={[{ width: size, height: size, alignSelf: "center" }, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(1, progress) * 100) }}
    >
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={COLORS.surface1} strokeWidth={thickness} fill="none" />
        <ACircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color ?? COLORS.accent}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          animatedProps={props}
          fill="none"
        />
      </Svg>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center, { padding: thickness + 10 }]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({ center: { alignItems: "center", justifyContent: "center" } });

export default ProgressRing;

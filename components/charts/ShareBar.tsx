import React, { useEffect } from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";
import { MOTION } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";

export interface ShareBarProps {
  /** Single-value mode: 0–1 fill. */
  value?: number;
  color?: string;
  /** Multi-part mode: proportional coloured parts (overrides value). */
  parts?: { value: number; color: string }[];
  height?: number;
  style?: StyleProp<ViewStyle>;
}

/** Slim proportion bar: one animated fill, or several parts side by side. */
const ShareBar: React.FC<ShareBarProps> = ({ value = 0, color, parts, height = 4, style }) => {
  const { COLORS } = useTheme();
  const reduced = useReducedMotion();
  const fill = useSharedValue(reduced ? Math.min(1, Math.max(0, value)) : 0);
  useEffect(() => {
    fill.value = withSpring(Math.min(1, Math.max(0, value)), MOTION.spring);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  const radius = height / 2;
  const track = { height, borderRadius: radius, backgroundColor: COLORS.surface1, overflow: "hidden" as const };

  if (parts && parts.length) {
    const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
    return (
      <View style={[track, { flexDirection: "row", gap: 2, backgroundColor: "transparent" }, style]}>
        {parts.map((p, i) =>
          p.value > 0 ? (
            <View key={i} style={{ flex: total > 0 ? p.value / total : 0, backgroundColor: p.color, borderRadius: radius }} />
          ) : null,
        )}
      </View>
    );
  }

  return (
    <View style={[track, style]}>
      <Animated.View style={[{ height, borderRadius: radius, backgroundColor: color ?? COLORS.accent }, fillStyle]} />
    </View>
  );
};

export default ShareBar;

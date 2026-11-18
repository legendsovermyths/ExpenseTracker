import React, { useEffect } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { MOTION } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";
import { timing } from "../ui/motion";

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
  const clamped = Math.min(1, Math.max(0, value));
  // Shown at its value on mount; slides (transform only) when the value changes.
  const fill = useSharedValue(clamped);
  const width = useSharedValue(0);
  useEffect(() => {
    fill.value = withTiming(clamped, timing(MOTION.tween));
  }, [clamped]); // eslint-disable-line react-hooks/exhaustive-deps
  const fillStyle = useAnimatedStyle(() => ({
    opacity: width.value > 0 ? 1 : 0,
    transform: [{ translateX: -(1 - fill.value) * width.value }],
  }));

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
    <View style={[track, style]} onLayout={(e) => (width.value = e.nativeEvent.layout.width)}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: color ?? COLORS.accent }, fillStyle]}
      />
    </View>
  );
};

export default ShareBar;

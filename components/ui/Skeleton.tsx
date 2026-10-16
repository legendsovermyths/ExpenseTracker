import React, { useEffect } from "react";
import { DimensionValue, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { RADIUS, SPACE } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Soft pulsing placeholder block. */
export const Skeleton: React.FC<SkeletonProps> = ({ width = "100%", height = 14, radius = RADIUS.sm, style }) => {
  const { COLORS } = useTheme();
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!reduced) pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
    return () => cancelAnimation(pulse);
  }, [reduced]);
  const animated = useAnimatedStyle(() => ({ opacity: 0.55 + pulse.value * 0.45 }));
  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: COLORS.surface1 }, animated, style]}
    />
  );
};

/** Placeholder matching a ListRow with a leading glyph. */
export const SkeletonRow: React.FC<{ padded?: boolean }> = ({ padded = false }) => (
  <View style={[styles.row, padded && { paddingHorizontal: SPACE.lg }]}>
    <Skeleton width={36} height={36} radius={10} />
    <View style={styles.text}>
      <Skeleton width="55%" height={13} />
      <Skeleton width="35%" height={10} style={{ marginTop: 8 }} />
    </View>
    <Skeleton width={56} height={13} />
  </View>
);

export const SkeletonList: React.FC<{ rows?: number; padded?: boolean }> = ({ rows = 6, padded }) => (
  <View>
    {Array.from({ length: rows }).map((_, i) => (
      <SkeletonRow key={i} padded={padded} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md, paddingVertical: SPACE.md },
  text: { flex: 1 },
});

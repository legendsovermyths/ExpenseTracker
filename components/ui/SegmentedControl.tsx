import React, { useState } from "react";
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";
import { MOTION, RADIUS, SPACE } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";
import Pressable from "./Pressable";
import Text from "./Text";

export interface SegmentOption<K extends string> {
  key: K;
  label: string;
}

// Infer K from `value` only (TS < 5.4 has no built-in NoInfer). Otherwise a
// `setState` onChange makes TS infer SetStateAction<K> and widen to string.
type NoInfer<T> = [T][T extends any ? 0 : never];

export interface SegmentedControlProps<K extends string> {
  /** Keys are typed loosely so K is inferred from `value`/`onChange`. */
  options: SegmentOption<string>[];
  value: K;
  onChange: (key: NoInfer<K>) => void;
  /** Compact size for section headers. */
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
}

function SegmentedControl<K extends string>({ options, value, onChange, size = "md", style }: SegmentedControlProps<K>) {
  const { COLORS, isDark } = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.key === value));
  const segW = width > 0 ? (width - PAD * 2) / options.length : 0;

  const thumbStyle = useAnimatedStyle(
    () => ({ transform: [{ translateX: withSpring(index * segW, MOTION.spring) }] }),
    [index, segW],
  );

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const h = size === "sm" ? 30 : 36;

  return (
    <View onLayout={onLayout} style={[styles.track, { height: h, backgroundColor: COLORS.surface1 }, style]}>
      {segW > 0 && (
        <Animated.View
          style={[
            styles.thumb,
            {
              width: segW,
              height: h - PAD * 2,
              backgroundColor: isDark ? COLORS.surface2 : COLORS.paper,
              borderColor: COLORS.hairline,
            },
            thumbStyle,
          ]}
        />
      )}
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            scale={false}
            haptic={active ? undefined : "selection"}
            onPress={() => !active && onChange(o.key as K)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={styles.segment}
          >
            <Text variant="caption" tone={active ? "ink" : "muted"} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const PAD = 2;

const styles = StyleSheet.create({
  track: { flexDirection: "row", borderRadius: RADIUS.sm + 2, padding: PAD, alignItems: "center" },
  thumb: {
    position: "absolute",
    left: PAD,
    top: PAD,
    borderRadius: RADIUS.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segment: { flex: 1, alignItems: "center", justifyContent: "center", height: "100%", paddingHorizontal: SPACE.sm },
});

export default SegmentedControl;

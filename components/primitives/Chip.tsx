import React, { useEffect, useRef, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View, ViewStyle, StyleProp } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { FONT, MOTION, SPACE, TYPE } from "../../constants";
import Pressable from "../ui/Pressable";
import { timing } from "../ui/motion";
import { useTheme } from "../../contexts/ThemeContext";

export interface ChipOption<K extends string = string> {
  key: K;
  label: string;
}

export interface ChipProps<K extends string = string> {
  options: ChipOption<K>[];
  value: K;
  onChange: (key: K) => void;
  style?: StyleProp<ViewStyle>;
}

// Indicator is a fixed-width bar scaled and moved on the UI thread, so it
// never animates layout.
const BASE = 100;

// Text tabs with an underline that glides to the active option.
function Chip<K extends string = string>({ options, value, onChange, style }: ChipProps<K>) {
  const { COLORS } = useTheme();
  const [frames, setFrames] = useState<{ x: number; w: number }[]>([]);

  const activeIdx = Math.max(
    0,
    options.findIndex((o) => o.key === value),
  );
  const target = frames[activeIdx];
  const ready = !!target;

  const tx = useSharedValue(0);
  const sx = useSharedValue(0);
  const placed = useRef(false);
  useEffect(() => {
    if (!target) return;
    const x = target.x + (target.w - BASE) / 2;
    const w = target.w / BASE;
    // Appear in place on first layout; glide on later changes.
    tx.value = placed.current ? withTiming(x, timing(MOTION.base)) : x;
    sx.value = placed.current ? withTiming(w, timing(MOTION.base)) : w;
    placed.current = true;
  }, [target?.x, target?.w]); // eslint-disable-line react-hooks/exhaustive-deps
  const indicator = useAnimatedStyle(
    (): ViewStyle => ({ transform: [{ translateX: tx.value }, { scaleX: sx.value }] }),
  );

  const onItemLayout = (idx: number) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setFrames((f) => {
      const next = [...f];
      next[idx] = { x, w: width };
      return next;
    });
  };

  return (
    <View style={[styles.row, style]}>
      {ready && (
        <Animated.View
          pointerEvents="none"
          style={[styles.indicator, { backgroundColor: COLORS.ink }, indicator]}
        />
      )}
      {options.map((opt, idx) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            feedback="none"
            haptic={active ? undefined : "selection"}
            onLayout={onItemLayout(idx)}
            onPress={() => !active && onChange(opt.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={styles.item}
          >
            <Text style={[styles.label, { color: active ? COLORS.ink : COLORS.inkMuted }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  item: {
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
  },
  label: {
    ...TYPE.callout,
    fontFamily: FONT.medium,
  },
  indicator: {
    position: "absolute",
    left: 0,
    bottom: 0,
    width: BASE,
    height: 2,
    borderRadius: 1,
  },
});

export default Chip;

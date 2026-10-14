import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
  StyleProp,
} from "react-native";
import { FONTS } from "../../constants";
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

// Segmented control with a spring-animated underline indicator.
// Indicator moves between options instead of swapping backgrounds.
function Chip<K extends string = string>({ options, value, onChange, style }: ChipProps<K>) {
  const { COLORS } = useTheme();
  const [widths, setWidths] = useState<number[]>([]);
  const [positions, setPositions] = useState<number[]>([]);

  const activeIdx = Math.max(
    0,
    options.findIndex((o) => o.key === value),
  );
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorW = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (positions[activeIdx] == null || widths[activeIdx] == null) return;
    Animated.parallel([
      Animated.spring(indicatorX, {
        toValue: positions[activeIdx],
        useNativeDriver: false,
        damping: 18,
        stiffness: 180,
        mass: 0.6,
      }),
      Animated.spring(indicatorW, {
        toValue: widths[activeIdx],
        useNativeDriver: false,
        damping: 18,
        stiffness: 180,
        mass: 0.6,
      }),
    ]).start();
  }, [activeIdx, positions, widths, indicatorX, indicatorW]);

  const onItemLayout = (idx: number) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setPositions((p) => {
      const next = [...p];
      next[idx] = x;
      return next;
    });
    setWidths((w) => {
      const next = [...w];
      next[idx] = width;
      return next;
    });
  };

  return (
    <View style={[styles.row, style]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.indicator,
          {
            backgroundColor: COLORS.ink,
            transform: [{ translateX: indicatorX }],
            width: indicatorW,
          },
        ]}
      />
      {options.map((opt, idx) => {
        const active = opt.key === value;
        return (
          <TouchableOpacity
            key={opt.key}
            onLayout={onItemLayout(idx)}
            onPress={() => onChange(opt.key)}
            activeOpacity={0.7}
            style={styles.item}
          >
            <Text
              style={[
                styles.label,
                {
                  color: active ? COLORS.ink : COLORS.inkMuted,
                  fontFamily: active ? "Roboto-Bold" : "Roboto-Regular",
                },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  item: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  label: {
    ...FONTS.bodyS,
    fontSize: 13,
  },
  indicator: {
    position: "absolute",
    height: 2,
    bottom: 0,
    borderRadius: 1,
  },
});

export default Chip;

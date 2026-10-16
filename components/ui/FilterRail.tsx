import React from "react";
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { SPACE } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";
import Pressable from "./Pressable";
import Text from "./Text";

export interface FilterOption<K extends string> {
  key: K;
  label: string;
}

// Infer K from `value` only (see SegmentedControl).
type NoInfer<T> = [T][T extends any ? 0 : never];

export interface FilterRailProps<K extends string> {
  options: FilterOption<string>[];
  value: K;
  onChange: (key: NoInfer<K>) => void;
  /** White text for full-bleed (dark media) screens. */
  onMedia?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Horizontally scrolling text tabs with an accent underline — for 4+ filters. */
function FilterRail<K extends string>({ options, value, onChange, onMedia, style }: FilterRailProps<K>) {
  const { COLORS } = useTheme();
  const activeColor = onMedia ? "#fff" : COLORS.ink;
  const idleColor = onMedia ? "rgba(255,255,255,0.6)" : COLORS.inkMuted;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={style}
      contentContainerStyle={styles.rail}
    >
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
            style={styles.tab}
          >
            <Text variant="headline" style={{ color: active ? activeColor : idleColor }}>
              {o.label}
            </Text>
            <View style={[styles.underline, { backgroundColor: active ? (onMedia ? "#fff" : COLORS.accent) : "transparent" }]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: { gap: SPACE.lg, paddingHorizontal: SPACE.gutter },
  tab: { paddingTop: SPACE.sm, alignItems: "center" },
  underline: { height: 2, borderRadius: 1, alignSelf: "stretch", marginTop: SPACE.xs + 2 },
});

export default FilterRail;

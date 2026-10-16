import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { SPACE } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";
import Text from "./Text";

export interface StatProps {
  value: React.ReactNode;
  label: string;
}

export const Stat: React.FC<StatProps> = ({ value, label }) => (
  <View style={styles.item}>
    {value}
    <Text variant="caption" tone="muted" numberOfLines={1}>
      {label}
    </Text>
  </View>
);

/** Row of key numbers separated by hairlines, sitting directly on paper. */
export const StatStrip: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({ children, style }) => {
  const { COLORS } = useTheme();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.strip, { borderBottomColor: COLORS.hairline }, style]}>
      {items.map((child, i) => (
        <React.Fragment key={i}>
          {i > 0 && <View style={[styles.divider, { backgroundColor: COLORS.hairline }]} />}
          {child}
        </React.Fragment>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  strip: { flexDirection: "row", paddingVertical: SPACE.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  item: { flex: 1, alignItems: "center", gap: 2 },
  divider: { width: StyleSheet.hairlineWidth, marginVertical: SPACE.xs },
});

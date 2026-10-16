import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SPACE } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";
import Text from "./Text";

export interface LargeTitleProps {
  title: string;
  subtitle?: string;
  /** Right-side actions, e.g. HeaderIconButtons. */
  right?: React.ReactNode;
  /** Add the top safe-area inset (fixed tab headers). Off inside Page. */
  topInset?: boolean;
  /** Apply the horizontal gutter. Off when the parent already pads. */
  gutter?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Large left-aligned title. Used fixed at the top of tab screens and
 * scrolling inside `Page`, so tabs and pushed pages read the same.
 */
const LargeTitle: React.FC<LargeTitleProps> = ({ title, subtitle, right, topInset = true, gutter = true, style }) => {
  const { COLORS } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: (topInset ? insets.top : 0) + SPACE.sm,
          paddingHorizontal: gutter ? SPACE.gutter : 0,
          backgroundColor: COLORS.paper,
        },
        style,
      ]}
    >
      <View style={styles.text}>
        <Text variant="largeTitle" numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text variant="callout" tone="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {right && <View style={styles.right}>{right}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingBottom: SPACE.sm,
    gap: SPACE.md,
  },
  text: { flex: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, paddingBottom: SPACE.xs },
});

export default LargeTitle;

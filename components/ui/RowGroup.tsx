import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { RADIUS, SPACE } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";

export interface RowGroupProps {
  children: React.ReactNode;
  /** Left inset of the separators, so they start under the row text. */
  inset?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The only container in the system: groups tappable rows (settings,
 * form fields) on a soft surface with hairline separators. Never use it
 * to box headlines or plain text — that content sits on paper.
 */
const RowGroup: React.FC<RowGroupProps> = ({ children, inset = SPACE.lg, style }) => {
  const { COLORS } = useTheme();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.group, { backgroundColor: COLORS.surface1 }, style]}>
      {items.map((child, i) => (
        <React.Fragment key={(child as any).key ?? i}>
          {i > 0 && (
            <View style={[styles.separator, { marginLeft: inset, backgroundColor: COLORS.hairline }]} />
          )}
          {child}
        </React.Fragment>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  group: { borderRadius: RADIUS.lg, overflow: "hidden" },
  separator: { height: StyleSheet.hairlineWidth },
});

export default RowGroup;

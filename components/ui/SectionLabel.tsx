import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { SPACE } from "../../constants";
import Text from "./Text";

export interface SectionLabelProps {
  title: string;
  /** Optional right-aligned accessory, e.g. a "See all" link or a segmented control. */
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const SectionLabel: React.FC<SectionLabelProps> = ({ title, right, style }) => (
  <View style={[styles.row, style]}>
    <Text variant="label" tone="muted" style={styles.title}>
      {title}
    </Text>
    {right}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: SPACE.xl,
    marginBottom: SPACE.sm,
    minHeight: 20,
  },
  title: { flexShrink: 1 },
});

export default SectionLabel;
